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
    name: 'AI Form Filler',
    description: 'Fills any form from your own knowledge base, in your own writing voice.',
    version: '0.0.1',

    permissions: [
      'storage',
      'identity',
      'sidePanel',
      // Lets the content script attach on the active tab only after the user acts,
      // instead of asking for host access to every site up front.
      'activeTab',
      'scripting',
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

    side_panel: { default_path: 'sidepanel.html' },
    action: { default_title: 'AI Form Filler' },
  },

  vite: () => ({
    plugins: [tailwindcss()],
  }),
})
