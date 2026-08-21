import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],

  /**
   * Don't launch a throwaway browser in dev.
   *
   * WXT's own Chrome profile is signed into nothing, which makes it useless for a tool whose
   * whole job is filling forms with your real identity.
   *
   * **`pnpm dev` writes to `.output/chrome-mv3-dev`, not `.output/chrome-mv3`.** Those are
   * two separate builds: `wxt` (dev) produces the first and keeps it live-reloading, `wxt
   * build` produces the second and only when you run it. Loading the wrong one is
   * indistinguishable from a fix not working — the extension simply stays on whatever was
   * last built into the folder Chrome is watching, and no error is reported anywhere.
   *
   * Load `.output/chrome-mv3-dev` unpacked in your normal Chrome and leave `pnpm dev`
   * running: it rebuilds and reloads the extension on every save, session and all.
   */
  webExt: {
    disabled: true,
  },

  /**
   * A build stamp, carried on the manifest.
   *
   * Chrome keeps the previously-injected content script alive in tabs that were already open
   * when the extension was reloaded, so a fix can be built, loaded, and still not be what a
   * given tab is running. Without a stamp those two states look identical from the outside.
   *
   * Read from the manifest at runtime rather than injected by a build-time `define`: a define
   * that silently fails to substitute leaves a bare identifier in the bundle, which throws a
   * ReferenceError and takes the whole content script with it. A missing manifest field just
   * prints `undefined`.
   */
  manifest: {
    version_name: `0.1.0+${new Date().toISOString().replace(/\D/g, '').slice(4, 12)}`,
    /**
     * Name and description are store-search surface, not just branding.
     *
     * "Fillaform" is a coined word nobody searches for, and the Web Store ranks heavily on the
     * name field, so the category the product actually competes in — AI form filler — is stated
     * in it. The description carries the same words for the same reason: these two strings are
     * what a listing is matched and skimmed on before anyone reads a screenshot.
     *
     * Limits Chrome enforces: name 75 chars (~45 visible in search), description 132.
     * The longer listing copy these two summarise lives in `store-assets/LISTING.md`.
     */
    name: 'Fillaform — AI Form Filler',
    description:
      'AI form filler for job applications and any web form. Answers come from your own knowledge base, in your own writing voice.',
    version: '0.0.1',

    permissions: [
      'storage',
      'identity',
      'sidePanel',
      // Lets the content script attach on the active tab only after the user acts,
      // instead of asking for host access to every site up front.
      'activeTab',
      'scripting',
      // Serves `/_favicon/` so a saved link shows the site's own mark from Chrome's cache,
      // rather than the extension fetching favicons from every site in someone's list.
      'favicon',
    ],

    // Broad host access is what a general-purpose form filler needs, but it is also the
    // single scariest line in the manifest for a Web Store reviewer. The content script
    // below only observes; nothing is transmitted until the user clicks fill.
    host_permissions: ['<all_urls>'],

    /**
     * Pins the extension ID.
     *
     * Without a key, Chrome derives an unpacked extension's ID from its **load path**, so
     * the same code loaded from two directories gets two different IDs. A Chrome Extension
     * OAuth client is bound to exactly one ID — which is why sign-in worked in one browser
     * and failed in another. With this key the ID is always:
     *
     *   bkjmijloddfiilopdckanmnpmiimpcho
     *
     * The matching private key lives in apps/extension/.keys/ and is gitignored. It is only
     * needed to reproduce this ID locally; the Web Store issues its own key at publish time.
     */
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyxaFDyiXe+tpz0u2Ab/fBOBJ++3uuL7BRIvndrSdVyqJRYGUV+2lVBjKhy0aOY94RVwgbIlYnSHMZ4Z3I13xBnvG4Xzt8vBghegQqI2tO1AhTZY8uMnaHj99tBJpRSGvvjr+IbRVziloRNhjPpWCkLbIITe8otzKUSI/JR5kxFml3HX7oS6tfmm8iZVXemWnKmfSMowmkLEjSdRHnzuC0ABs2W6KKbvhUbuv/Pawmh/c9WOcR1BRWyp21ILIIScj+9wxxh81Njz2DaJceu7rV7whJ8MD1cjWv5wEYG7uYUXOfOH/HbS4rgAvht0bIdUOzk2TTXssy7Bk8y56HFUTIQIDAQAB',

    oauth2: {
      // Must stay byte-identical to GOOGLE_CLIENT_ID in apps/api/.dev.vars — the server
      // checks every inbound token's `aud` against it, so a mismatch surfaces as
      // INVALID_TOKEN at sign-in rather than as a configuration error.
      client_id: '451054635835-h8ggt0gsmni72nhaljbbsjt1rpkj93ol.apps.googleusercontent.com',
      scopes: ['openid', 'email', 'profile'],
    },

    /**
     * The mascot's face, rasterised from the same geometry `Mascot` draws in the panel and
     * `apps/web/public/favicon.svg` serves on the site. Chrome takes PNG only, so these are
     * generated rather than referenced from the SVG.
     *
     * 16 and 32 are drawn from a bolder variant: the 40-unit face thins out below ~24px and
     * the mouth disappears entirely if you simply downsample the large one.
     */
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },

    side_panel: { default_path: 'sidepanel.html' },
    action: { default_title: 'Fillaform — AI form filler' },

    /**
     * Fill without reaching for the mouse.
     *
     * The launcher is a 38px circle pinned to the right edge of a page whose form the user is
     * already typing in — so the gesture it asks for is "leave the keyboard, cross the window,
     * hit a small target". The command removes that, and the rail beside the circle exists to
     * teach it: it reads the binding back out of `chrome.commands`, so what it shows is what is
     * actually bound.
     *
     * `Alt+F` — the shortest thing Chrome will accept. A bare `F` is not on offer: `commands`
     * entries must carry `Ctrl`, `Alt`, or `Command`, and that requirement is the feature here
     * rather than a limitation, because the page this fires on is a form somebody is typing
     * into. A single letter would fill the form every time they typed one.
     *
     * Chrome maps `Alt` to Option on macOS, so one suggestion covers both platforms. On
     * Windows and Linux `Alt+F` is also Chrome's own menu, so Chrome may decline to bind it and
     * leave the command unbound — the launcher handles that correctly rather than lying about
     * it: it reads the real binding out of `chrome.commands` and shows no key at all when there
     * isn't one. Rebinding lives at chrome://extensions/shortcuts, and the label follows.
     */
    commands: {
      'fill-form': {
        suggested_key: { default: 'Alt+F' },
        description: 'Fill this form',
      },
    },
  },

  vite: () => ({
    plugins: [tailwindcss()],
  }),
})
