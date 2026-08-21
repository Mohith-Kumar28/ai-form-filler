/**
 * The Chrome Web Store listing artwork, built from the real product.
 *
 * `node store-assets/build.mjs` regenerates every image the store asks for. Nothing here is
 * drawn by hand or traced from a design file: the panel and the on-page overlay in these
 * compositions are **screenshots of the shipped components**, captured out of `gallery/` — the
 * same harness the UI is reviewed in — and then laid up on a brand ground.
 *
 * That is the whole point of doing it this way rather than in a design tool. A store listing is
 * the one place a product is judged before it is installed, and a mock that has drifted from the
 * build is a promise the extension then fails to keep. When the panel changes, this rebuilds and
 * the listing is right again.
 *
 * ### Pipeline
 *
 *   1. `pnpm --filter @aff/extension gallery` builds the review harness to `.gallery/`.
 *   2. Playwright captures the panel screens (light and dark) at 3x, and clipped regions of the
 *      on-page overlay, into `store-assets/.raw/`.
 *   3. Each composition is rendered as a page sized to exactly one store asset and screenshotted
 *      at deviceScaleFactor 1, because the store checks pixel dimensions and rejects anything
 *      that is off by one.
 *
 * ### Sizes, and where each one is used
 *
 *   store icon      128 x 128    the listing header and every search result
 *   screenshot      1280 x 800   the carousel, five of them, shown at about half size
 *   small tile      440 x 280    category and search surfaces. Listings without one rank lower.
 *   marquee         1400 x 560   editorial and featured placement only
 *   og image        1200 x 630   not a store asset; the site references `/og-default.png`
 *
 * Sources: https://developer.chrome.com/docs/webstore/images
 */

import { execFile } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { chromium } from 'playwright'

const run = promisify(execFile)
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const RAW = join(HERE, '.raw')
const PORT = 4711
const ORIGIN = `http://127.0.0.1:${PORT}`

/* ─────────────────────────────────────────────────────────────────────────────────────────
   A static server rooted at the repo.

   The compositions need three things from disk at once: the captured PNGs under `.raw/`, the
   stylesheet next door, and the two variable fonts the product actually ships from
   `apps/extension/public/fonts/`. Serving the repo root is what lets one page reference all
   three by absolute path. `file://` cannot: the font faces resolve from the stylesheet's own
   origin and come back opaque, and the whole page then renders in a system fallback — a
   substitution that is invisible in a diff and obvious in the finished artwork.
   ───────────────────────────────────────────────────────────────────────────────────────── */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
}

function startServer(root) {
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname))
    try {
      const body = await readFile(join(root, path))
      res.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' })
      res.end(body)
    } catch {
      res.writeHead(404).end('not found')
    }
  })
  return new Promise((done) => server.listen(PORT, '127.0.0.1', () => done(server)))
}

/* ─────────────────────────────────────────────────────────────────────────────────────────
   The mascot, in markup.

   One geometry, three consumers — `apps/web/public/favicon.svg`, the panel's `Mascot`, and
   this. Restated here for the same reason the palette is: these pages are rendered without a
   bundler, so there is nothing to import a component with.
   ───────────────────────────────────────────────────────────────────────────────────────── */

function mascot(size, id = 'm') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8b4bd1"/><stop offset="0.55" stop-color="#e0459b"/><stop offset="1" stop-color="#f2a133"/>
    </linearGradient></defs>
    <circle cx="20" cy="20" r="20" fill="url(#${id})"/>
    <g fill="#fff"><circle cx="14.5" cy="16.5" r="2.4"/><circle cx="25.5" cy="16.5" r="2.4"/></g>
    <path d="M14.5 24.5q5.5 5 11 0" stroke="#fff" stroke-width="2.4" stroke-linecap="round" fill="none"/>
  </svg>`
}

/**
 * The face, tiled, as a background.
 *
 * Flat violet rather than the gradient: at five percent opacity a three-stop gradient reads as
 * uneven blotches, where one colour reads as a texture. Two faces per tile on opposite
 * diagonals so the repeat does not line up into visible rows.
 */
const FACE_PATTERN = (() => {
  const face = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s / 40})">
    <circle cx="20" cy="20" r="19" fill="none" stroke="#5b21b6" stroke-width="2.6"/>
    <circle cx="14.5" cy="16.5" r="2.6" fill="#5b21b6"/><circle cx="25.5" cy="16.5" r="2.6" fill="#5b21b6"/>
    <path d="M14 24.5q6 5.5 12 0" stroke="#5b21b6" stroke-width="2.6" stroke-linecap="round" fill="none"/></g>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="92" height="92" viewBox="0 0 92 92">${face(4, 4, 30)}${face(50, 50, 30)}</svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
})()

/* Glyphs, matched to the ones the panel uses for the same two meanings. */
const TICK = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.2 3.2L13 4.6" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const SPARKLE = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0l1.5 5.1L15 8l-5.5 2.9L8 16l-1.5-5.1L1 8l5.5-2.9z"/></svg>`

/* ─────────────────────────────────────────────────────────────────────────────────────────
   Page scaffolding
   ───────────────────────────────────────────────────────────────────────────────────────── */

function page({ width, height, dark = false, body, css = '' }) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/store-assets/src/base.css">
<style>
  :root { --face-pattern: ${FACE_PATTERN}; }
  body { width: ${width}px; height: ${height}px; }
  .canvas { width: ${width}px; height: ${height}px; }
  ${css}
</style></head><body>
<div class="canvas${dark ? ' dark' : ''}"><div class="bg"></div>${body}</div>
</body></html>`
}

/** The headline block every screenshot opens with, so all five share one entry rhythm. */
function heading({ kicker, title, sub }) {
  return `<header class="head">
    <p class="kicker">${mascot(20, `k${kicker.length}`)}${kicker}</p>
    <h1>${title}</h1>
    <p class="sub">${sub}</p>
  </header>`
}

const HEAD_CSS = `
  .head { position: absolute; top: 74px; left: 76px; width: 1128px; z-index: 5; }
  .head h1 { margin-top: 20px; }
  .head .sub { margin-top: 16px; max-width: 700px; }
`

/** A browser window with the real job page in it, and the real panel docked beside it. */
function browserWindow({ url, page: pageImg, panelImg, panelWidth = 340, dark = false }) {
  return `<div class="browser">
    <div class="chrome">
      <div class="dots"><i></i><i></i><i></i></div>
      <div class="urlbar"><svg width="11" height="11" viewBox="0 0 16 16" fill="none"><rect x="3.2" y="7" width="9.6" height="7" rx="1.6" stroke="currentColor" stroke-width="1.5"/><path d="M5.6 7V5a2.4 2.4 0 014.8 0v2" stroke="currentColor" stroke-width="1.5"/></svg>${url}</div>
      <span class="pinned">${mascot(22, dark ? 'pd' : 'pl')}</span>
    </div>
    <div class="viewport">
      <div class="page"><img src="${pageImg}" alt=""></div>
      <div class="docked" style="width:${panelWidth}px"><img src="${panelImg}" alt=""></div>
    </div>
  </div>`
}

/* ─────────────────────────────────────────────────────────────────────────────────────────
   The five carousel slides.

   One idea each, in the order somebody decides in: what it does, how good the answers are,
   why you can trust them, what you feed it, and where it works. Every claim is one the product
   makes on the site, and the artwork under each is the feature actually running.
   ───────────────────────────────────────────────────────────────────────────────────────── */

const SHOT = { width: 1280, height: 800 }

const slides = [
  {
    name: '1-fill-any-form',
    ...SHOT,
    css: `${HEAD_CSS}
      .head { top: 62px; width: 830px; }
      .head h1 { font-size: 62px; }
      .head .sub { font-size: 19px; max-width: 812px; }
      /* Centred horizontally and running off the bottom edge: a form somebody is part-way
         through, not a product shot of one. */
      .stage { position: absolute; top: 300px; left: 76px; width: 1128px; }
      .browser { width: 1128px; }
      .viewport { height: 560px; }
      .page img { height: 560px; }
      .docked img { height: 560px; }
      .keys { position: absolute; top: 250px; left: 78px; display: flex; align-items: center; gap: 9px;
              font-size: 15px; font-weight: 600; color: var(--ink-dim); letter-spacing: -0.01em; }
      kbd { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; padding: 5px 9px;
            border-radius: 7px; background: var(--surface-raised); border: 1px solid var(--border);
            box-shadow: 0 1.5px 0 var(--border); color: var(--ink); }`,
    body: ({ raw }) => `
      <div class="spine"></div>
      ${heading({
        kicker: 'Fillaform',
        title: 'Fill any form in one click',
        sub: 'Job applications, Google Forms, registrations, surveys, ATS portals. If a page has fields, Fillaform answers them — from your CV and your own notes, in the way you write.',
      })}
      <p class="keys"><kbd>⌥</kbd><kbd>F</kbd> — or the button on the page. Twelve fields, about fifteen seconds.</p>
      <div class="stage">
        ${browserWindow({
          url: 'boards.greenhouse.io/aldermanroe/jobs/senior-platform-engineer',
          page: `${raw}/page-light.png`,
          panelImg: `${raw}/light-home.png`,
          panelWidth: 348,
        })}
      </div>`,
  },

  {
    name: '2-written-answers',
    ...SHOT,
    css: `${HEAD_CSS}
      .head { width: 580px; }
      .head h1 { font-size: 56px; }
      .head .sub { font-size: 19px; max-width: 540px; }
      /*
        The card, at the size where its own rows are readable at half scale.

        There were two callouts pinned to the chips row and the instruction field here. They came
        out over the prose on the left that says the same thing in words, and the gap between the
        two columns is 48px — nowhere for a 190px label to stand. The card shows six chips and a
        "tell it what to change" field plainly enough on its own.
      */
      .cardwrap { position: absolute; top: 194px; right: 78px; width: 556px; }
      .card { position: relative; border-radius: 16px; overflow: hidden; border: 1px solid var(--border);
              background: #fff; box-shadow: 0 3px 6px var(--shadow), 0 60px 110px -34px var(--shadow-strong),
              0 16px 40px -20px var(--shadow-strong); }
      .card img { display: block; width: 100%; }
      .list { position: absolute; top: 404px; left: 76px; width: 546px; display: flex; flex-direction: column; gap: 15px; }
      .row { display: flex; gap: 14px; align-items: flex-start; font-size: 17px; line-height: 1.42;
             color: var(--ink-muted); letter-spacing: -0.008em; }
      .row b { color: var(--ink); font-weight: 650; }
      .row .swatch { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid;
                     place-items: center; margin-top: 1px; }
`,
    body: ({ raw }) => `
      <div class="spine"></div>
      ${heading({
        kicker: 'Written answers',
        title: 'Not templates.<br>Answers.',
        sub: '“Why do you want to work here?” gets a real answer, drawn from your own notes and written in your voice.',
      })}
      <div class="cardwrap">
        <div class="card"><img src="${raw}/x-answercard.png" alt=""></div>
      </div>
      <div class="list">
        <p class="row"><span class="swatch" style="background:var(--accent-muted);color:var(--accent)">${SPARKLE}</span>
          <span><b>Nudge it, don’t redo it.</b> Warmer, plainer, shorter, more formal — applied to the answer you already have, not a fresh one.</span></p>
        <p class="row"><span class="swatch" style="background:var(--accent-muted);color:var(--accent)">${SPARKLE}</span>
          <span><b>Or just say what to change.</b> Type the instruction and it rewrites to order.</span></p>
        <p class="row"><span class="swatch" style="background:var(--positive-muted);color:var(--positive)">${TICK}</span>
          <span><b>It learns as you go.</b> Every answer you settle on teaches it how you write — the tenth application reads more like you than the first.</span></p>
      </div>`,
  },

  {
    name: '3-what-it-guessed',
    ...SHOT,
    css: `${HEAD_CSS}
      .head { width: 720px; }
      .head h1 { font-size: 56px; }
      .legend { position: absolute; top: 342px; left: 76px; display: flex; gap: 12px; }
      /* Two labelled artefacts, one per surface: the same fill as the page sees it and as the
         panel accounts for it. The tags are the whole point — without them this is two
         screenshots, with them it is one claim shown twice. */
      .marks { position: absolute; top: 448px; left: 76px; width: 600px; border-radius: 14px;
               overflow: hidden; border: 1px solid var(--border); background: #fff;
               box-shadow: 0 3px 6px var(--shadow), 0 44px 90px -30px var(--shadow-strong); }
      .marks img { display: block; width: 100%; }
      /* Outside the frames, not inside them: both frames clip their overflow so a screenshot's
         corners come out round, which also swallowed a label placed within one. */
      .tag { position: absolute; font-size: 12px; font-weight: 700; letter-spacing: 0.15em;
             text-transform: uppercase; color: var(--ink-dim); }
      .tag-page { top: 418px; left: 78px; }
      .tag-panel { top: 102px; right: 78px; }
      .panel { position: absolute; top: 132px; right: 78px; width: 372px; }
      .panel img { height: 670px; }`,
    body: ({ raw }) => `
      <div class="spine"></div>
      ${heading({
        kicker: 'Nothing is confidently wrong',
        title: 'It tells you what it guessed',
        sub: 'A wrong-but-confident answer on a job application is worse than a blank field. So the ones it worked out are labelled, and the ones read straight off your details are left alone.',
      })}
      <div class="legend">
        <span class="chip"><span class="tick">${TICK}</span>From what you told it — unmarked</span>
        <span class="chip"><span style="color:var(--accent)">${SPARKLE}</span>Judged — check this one</span>
      </div>
      <span class="tag tag-page">On the page</span>
      <div class="marks"><img src="${raw}/x-marks.png" alt=""></div>
      <span class="tag tag-panel">In the panel</span>
      <div class="panel"><img src="${raw}/light-receipt.png" alt=""></div>`,
  },

  {
    name: '4-feed-it-anything',
    ...SHOT,
    dark: true,
    css: `${HEAD_CSS}
      .head { width: 580px; }
      .head h1 { font-size: 54px; }
      .head .sub { max-width: 548px; font-size: 19px; }
      .kinds { position: absolute; top: 356px; left: 76px; width: 556px; display: flex; flex-wrap: wrap; gap: 10px; }
      .note { position: absolute; top: 526px; left: 76px; width: 546px; font-size: 17px; line-height: 1.5;
              color: var(--d-ink-muted); letter-spacing: -0.008em; }
      .note b { color: var(--d-ink); font-weight: 650; }
      /* Two screens, stepped: everything you fed it, and everything it now knows. The step is
         what says they are the same screen at two tabs rather than two unrelated panels. */
      .pair { position: absolute; top: 84px; right: 22px; display: flex; gap: 20px; }
      .pair .panel { width: 300px; }
      .pair .panel img { height: 540px; }
      .pair .panel:first-child { transform: translateY(58px); }`,
    body: ({ raw }) => `
      <div class="spine"></div>
      ${heading({
        kicker: 'One setup, then never again',
        title: 'Feed it however you like',
        sub: 'A CV, a spreadsheet, a portfolio link, a screenshot — or talk for a minute and let it listen.',
      })}
      <div class="kinds">
        <span class="chip">PDF &amp; Word</span>
        <span class="chip">Slides &amp; spreadsheets</span>
        <span class="chip">Links</span>
        <span class="chip">Pasted text</span>
        <span class="chip">Images</span>
        <span class="chip">Voice notes</span>
      </div>
      <p class="note"><b>And the things no document mentions.</b> Add facts by hand — notice period, earliest start, salary expectations, work authorisation — and they answer with no AI call at all.</p>
      <div class="pair">
        <div class="panel"><img src="${raw}/dark-sources.png" alt=""></div>
        <div class="panel"><img src="${raw}/dark-facts.png" alt=""></div>
      </div>`,
  },

  {
    name: '5-yours-to-submit',
    ...SHOT,
    css: `${HEAD_CSS}
      .head { width: 660px; }
      .head h1 { font-size: 56px; }
      .head .sub { max-width: 620px; font-size: 19px; }
      .sites { position: absolute; top: 352px; left: 76px; width: 640px; display: flex; flex-wrap: wrap; gap: 10px; }
      .rules { position: absolute; top: 476px; left: 76px; width: 636px; display: flex; flex-direction: column; gap: 16px; }
      .rule { display: flex; gap: 14px; align-items: flex-start; font-size: 17px; line-height: 1.42;
              color: var(--ink-muted); letter-spacing: -0.008em; }
      .rule b { color: var(--ink); font-weight: 650; }
      .rule .swatch { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid;
                      place-items: center; margin-top: 1px; background: var(--positive-muted); color: var(--positive); }
      /* The dark panel on the light ground, at full height — the receipt's own last line is the
         claim this slide makes, and cropping it off to fit was not an option. */
      .panel { position: absolute; top: 98px; right: 78px; width: 358px; }
      .panel img { height: 644px; }`,
    body: ({ raw }) => `
      <div class="spine"></div>
      ${heading({
        kicker: 'Built for the real thing',
        title: 'Yours to review.<br>Yours to submit.',
        sub: 'Fillaform fills the fields and stops. Nothing is sent anywhere until you press the button yourself.',
      })}
      <div class="sites">
        <span class="chip"><span class="tick">${TICK}</span>Greenhouse</span>
        <span class="chip"><span class="tick">${TICK}</span>Lever</span>
        <span class="chip"><span class="tick">${TICK}</span>Ashby</span>
        <span class="chip"><span class="tick">${TICK}</span>Google Forms</span>
        <span class="chip"><span class="tick">${TICK}</span>Everything else</span>
      </div>
      <div class="rules">
        <p class="rule"><span class="swatch">${TICK}</span><span><b>Nothing is submitted for you.</b> It writes into the fields and hands the page straight back.</span></p>
        <p class="rule"><span class="swatch">${TICK}</span><span><b>Your details stay yours.</b> Delete any source, any fact, or the whole lot, whenever you like.</span></p>
        <p class="rule"><span class="swatch">${TICK}</span><span><b>Light or dark, on any site.</b> The on-page layer reads the page it lands on, not your laptop.</span></p>
      </div>
      <div class="panel"><img src="${raw}/dark-receipt.png" alt=""></div>`,
  },
]

/* ─────────────────────────────────────────────────────────────────────────────────────────
   The promotional tiles, the store icon, and the site's share card.

   These carry almost no text on purpose. The store's own guidance is that a promo tile has to
   survive being shrunk to half size on a grey grid, and the thing that survives that is the
   face and the name — a sentence does not.
   ───────────────────────────────────────────────────────────────────────────────────────── */

const others = [
  {
    /* The small tile: 440 x 280, and the one image the store treats as mandatory. At 220px wide
       in a category grid this is a face, a name, and five words. */
    name: 'promo/small-tile-440x280',
    width: 440,
    height: 280,
    css: `.canvas { background: var(--sunset); display: grid; place-items: center; }
      .canvas::before { background: radial-gradient(80% 70% at 24% 6%, oklch(100% 0 0 / 0.24), transparent 60%); }
      .canvas::after { opacity: 0.11; background-size: 74px 74px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='74' height='74' viewBox='0 0 74 74'%3E%3Cg fill='none' stroke='%23fff' stroke-width='2.4'%3E%3Ccircle cx='21' cy='21' r='15'/%3E%3Cpath d='M15 25q6 5 12 0' stroke-linecap='round'/%3E%3C/g%3E%3Cg fill='%23fff'%3E%3Ccircle cx='16.6' cy='17.4' r='2.2'/%3E%3Ccircle cx='25.4' cy='17.4' r='2.2'/%3E%3C/g%3E%3C/svg%3E"); }
      .inner { position: relative; z-index: 2; display: flex; flex-direction: column;
               align-items: center; gap: 16px; text-align: center; }
      /*
        A white plate under the mark.

        The mascot is a gradient circle and the tile is the same gradient, so at first pass the
        face vanished into its own background and the tile read as a coloured rectangle with a
        name on it. The plate is also how the icon appears everywhere else it is seen — in a
        Chrome toolbar, on a white surface — so this is the familiar object, not a new one.
      */
      .face { display: grid; place-items: center; padding: 11px; border-radius: 50%;
              background: oklch(99.3% 0.003 320);
              box-shadow: 0 12px 26px oklch(20% 0.1 320 / 0.3); }
      .name { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 47px;
              letter-spacing: -0.04em; color: #fff; line-height: 1; }
      .line { font-size: 17px; font-weight: 600; letter-spacing: -0.008em; color: oklch(100% 0 0 / 0.9); }`,
    body: () => `<div class="inner">
      <span class="face">${mascot(76, 'st')}</span>
      <p class="name">Fillaform</p>
      <p class="line">Fill any form in one click</p>
    </div>`,
  },

  {
    /* The marquee: 1400 x 560, editorial placement only, and the store cares most that it is
       uncluttered. One line, and the product bleeding off the right edge. */
    name: 'promo/marquee-1400x560',
    width: 1400,
    height: 560,
    dark: true,
    css: `.left { position: absolute; top: 122px; left: 84px; width: 552px; }
      .wordmark { font-size: 38px; color: var(--d-ink); }
      .left h1 { margin-top: 32px; font-size: 54px; color: var(--d-ink); }
      .left .sub { margin-top: 18px; font-size: 20px; max-width: 528px; }
      /*
        Both artefacts placed from the right edge, and only the panel allowed off the bottom.

        The first cut ran the headline under the answer card and sliced "click" in half, which is
        the one failure a marquee cannot survive — it is used at editorial sizes where the
        wordmark and the sentence are the whole point.
      */
      .panel { position: absolute; top: 48px; right: 62px; width: 330px; }
      .panel img { height: 594px; }
      .card { position: absolute; top: 168px; right: 424px; width: 316px; border-radius: 14px;
              overflow: hidden; border: 1px solid var(--d-border); background: #fff;
              box-shadow: 0 46px 96px -28px oklch(0% 0 0 / 0.74); }
      .card img { display: block; width: 100%; }`,
    body: ({ raw }) => `
      <div class="left">
        <p class="wordmark">${mascot(46, 'mq')}Fillaform</p>
        <h1>Fill any form in one click</h1>
        <p class="sub">Answered from your CV and your own notes, in your own words — and it tells you which answers it guessed.</p>
      </div>
      <div class="card"><img src="${raw}/x-answercard.png" alt=""></div>
      <div class="panel"><img src="${raw}/dark-receipt.png" alt=""></div>`,
  },

  {
    /*
      The store icon: 128 x 128 with the face at 96 and 16px of transparency on every side.

      `apps/extension/public/icon/128.png` is full-bleed, which is right for a Chrome toolbar and
      wrong here — the store composites the icon onto its own surface at several sizes and relies
      on that margin. Rendered separately rather than by re-padding the shipped PNG, which would
      resample a 128px circle up and soften its edge.
    */
    name: 'icon-128',
    width: 128,
    height: 128,
    css: `.canvas { background: transparent; display: grid; place-items: center; }
      .bg { display: none; }`,
    body: () => mascot(96, 'ic'),
    transparent: true,
  },

  {
    /* Not a store asset. `apps/web/src/lib/site.ts` points `ogImage` at `/og-default.png`, which
       has never existed — so every link to the site has been sharing as a blank card. */
    name: 'social/og-1200x630',
    width: 1200,
    height: 630,
    css: `.inner { position: absolute; top: 96px; left: 84px; width: 700px; }
      .wordmark { font-size: 36px; }
      .inner h1 { margin-top: 30px; font-size: 68px; }
      .inner .sub { margin-top: 20px; font-size: 22px; max-width: 620px; }
      .foot { position: absolute; bottom: 62px; left: 86px; font-size: 18px; font-weight: 600;
              color: var(--ink-dim); letter-spacing: -0.008em; }
      .panel { position: absolute; top: 88px; right: 44px; width: 340px; }
      .panel img { height: 542px; }`,
    body: ({ raw }) => `
      <div class="inner">
        <p class="wordmark">${mascot(42, 'og')}Fillaform</p>
        <h1>Fill any form in one click</h1>
        <p class="sub">Job applications, Google Forms, registrations, surveys — answered from your CV and your notes, in your own words.</p>
      </div>
      <p class="foot">fillaform.in · Chrome extension</p>
      <div class="panel"><img src="${raw}/light-receipt.png" alt=""></div>`,
  },
]

/* ─────────────────────────────────────────────────────────────────────────────────────────
   Step 1 and 2 — build the harness, capture the product
   ───────────────────────────────────────────────────────────────────────────────────────── */

/** Panel screens, by their index in `gallery/main.tsx`. Reorder that file and these shift. */
const PANELS = {
  6: 'receipt',
  7: 'facts',
  12: 'sources',
  /*
    The Home screen in its onboarding state, not its subscribed one.

    Frame 1 is the same screen with a "Pro" badge in the header, and a plan badge in a store
    screenshot reads as a price tag on the front door. This state is the one the panel is
    designed to say nothing about money in — same page, same button, no badge and no meter.
  */
  17: 'home',
}

async function capturePanels(browser) {
  for (const scheme of ['light', 'dark']) {
    const tab = await browser.newPage({
      viewport: { width: 2400, height: 1400 },
      deviceScaleFactor: 3,
    })
    await tab.goto(`${ORIGIN}/apps/extension/.gallery/index.html?scheme=${scheme}`, {
      waitUntil: 'networkidle',
    })
    await tab.waitForTimeout(1600)
    const figures = await tab.$$('figure')
    for (const [index, name] of Object.entries(PANELS)) {
      const frame = figures[Number(index)]
      if (!frame)
        throw new Error(`gallery frame ${index} (${name}) is missing — did main.tsx change?`)
      await (await frame.$(':scope > div')).screenshot({ path: join(RAW, `${scheme}-${name}.png`) })
    }
    await tab.close()
  }
}

/**
 * The on-page layer, clipped out of the overlay harness.
 *
 * Two things make this work. The harness annotates itself with `.caption` and `.note`
 * paragraphs explaining each state, which have no business in a store listing; hiding them
 * shortens the page, so every overlay the position scheduler already placed has to be
 * re-measured — hence the resize event and the wait. And the clip is computed from a form
 * field's own box rather than written down, because those numbers move whenever the harness
 * does, and a stale clip crops the subject in half without failing.
 */
async function captureOverlay(browser) {
  const shots = [
    /*
      The page itself, as it looks part-way through a review.

      `fit` pins the bottom of the crop under the last judged field and takes a fixed height
      upwards, so the band always ends on the marks and always matches the aspect of the browser
      window it is dropped into — 779 x 560 in slide one. Anchoring the top instead would let the
      interesting part fall out of frame the moment the harness gained a field.
    */
    {
      name: 'page-light',
      qs: 'only=marks',
      ids: ['hear'],
      x: 96,
      width: 944,
      fit: 679,
      bottom: 30,
    },
    /*
      The answer card alone, cropped to its own bounds.

      `only=answer` keeps the launcher's menu from mounting over its top corner, and `rect` takes
      the clip from `window.__overlayRects` — the harness reporting where it actually put the
      card, rather than this file guessing from the anchor field and then going quietly stale the
      next time the card grows a row.
    */
    {
      name: 'x-answercard',
      qs: 'only=answer',
      rect: 'answer',
      pad: 0,
    },
    // Field marks: one stated and unmarked, two judged and labelled.
    {
      name: 'x-marks',
      qs: 'only=marks',
      ids: ['start', 'hear'],
      x: 180,
      width: 520,
      top: 34,
      bottom: 26,
    },
  ]

  for (const shot of shots) {
    const tab = await browser.newPage({
      viewport: { width: 1040, height: 1500 },
      deviceScaleFactor: 3,
    })
    await tab.goto(`${ORIGIN}/apps/extension/.gallery/overlay.html?${shot.qs}`, {
      waitUntil: 'networkidle',
    })
    /*
      Strip the harness's own commentary, then make the overlay re-measure.

      `.caption` and `.note` are the notes-to-a-reviewer that explain each state — "the launcher
      is bottom-right, unlinked to any specific field" — and a store listing that ships them is
      a listing with the reviewer's margin notes printed on it. Removing them shortens the page,
      which moves every field the position scheduler had already measured, so the resize event
      is not optional: without it the judged pills stay pinned to where their inputs used to be.
    */
    await tab.addStyleTag({ content: '.caption, .note { display: none !important }' })
    // The harness names its sections after the overlay state each one demonstrates. On a page
    // standing in for a real job application, those are the wrong words.
    await tab.evaluate(() => {
      const sections = ['About you', 'Eligibility', 'Why this role', 'Details']
      document.querySelectorAll('h2').forEach((h, i) => {
        if (sections[i]) h.textContent = sections[i]
      })
      window.dispatchEvent(new Event('resize'))
    })
    await tab.waitForTimeout(1900)
    let clip
    if (shot.rect) {
      // The harness's own measurement of what it mounted, padded out to leave the drop shadow
      // room. Nothing else can see inside a closed shadow root.
      const box = await tab.evaluate((name) => {
        const rect = window.__overlayRects?.[name]
        if (!rect) throw new Error(`the overlay harness published no rect named "${name}"`)
        return rect
      }, shot.rect)
      const pad = shot.pad ?? 0
      clip = {
        x: box.x - pad,
        y: box.y - pad,
        width: box.width + pad * 2,
        height: box.height + pad * 2,
      }
    } else {
      const box = await tab.evaluate((ids) => {
        const boxes = ids.map((id) => document.getElementById(id).getBoundingClientRect())
        return {
          top: Math.min(...boxes.map((b) => b.top)) + window.scrollY,
          bottom: Math.max(...boxes.map((b) => b.bottom)) + window.scrollY,
        }
      }, shot.ids)
      const bottom = box.bottom + (shot.bottom ?? 0)
      clip = {
        x: shot.x,
        y: Math.max(0, shot.fit ? bottom - shot.fit : box.top - (shot.top ?? 0)),
        width: shot.width,
        height: shot.fit ?? box.bottom - box.top + (shot.top ?? 0) + (shot.bottom ?? 0),
      }
    }

    await tab.screenshot({ path: join(RAW, `${shot.name}.png`), clip })
    await tab.close()
  }
}

/* ─────────────────────────────────────────────────────────────────────────────────────────
   Step 3 — render the compositions
   ───────────────────────────────────────────────────────────────────────────────────────── */

/** Every page slug written this run, so the intermediates can be cleaned up by name. */
const rendered = []

async function render(browser, spec) {
  const slug = spec.name.replace(/\//g, '-')
  rendered.push(slug)
  const html = page({
    width: spec.width,
    height: spec.height,
    dark: spec.dark,
    css: spec.css,
    body: spec.body({ raw: '/store-assets/.raw' }),
  })
  await writeFile(join(RAW, `page-${slug}.html`), html)

  const tab = await browser.newPage({
    viewport: { width: spec.width, height: spec.height },
    // 1, not 2: the store validates pixel dimensions, and a retina capture of a 1280-wide page
    // is a 2560-wide file that is rejected without ever being looked at.
    deviceScaleFactor: 1,
  })
  await tab.goto(`${ORIGIN}/store-assets/.raw/page-${slug}.html`, { waitUntil: 'networkidle' })
  await tab.evaluate(() => document.fonts.ready)
  await tab.waitForTimeout(500)
  const out = join(HERE, `${spec.name}.png`)
  await mkdir(dirname(out), { recursive: true })
  await tab.screenshot({ path: out, omitBackground: Boolean(spec.transparent) })
  await tab.close()
  return out
}

/* ─────────────────────────────────────────────────────────────────────────────────────────
   Main
   ───────────────────────────────────────────────────────────────────────────────────────── */

const skipGallery = process.argv.includes('--no-gallery')

await mkdir(RAW, { recursive: true })

if (!skipGallery) {
  process.stdout.write('building the review harness… ')
  await run('pnpm', ['--filter', '@aff/extension', 'gallery'], { cwd: REPO })
  process.stdout.write('done\n')
}

const server = await startServer(REPO)
const browser = await chromium.launch()

try {
  process.stdout.write('capturing the panel… ')
  await capturePanels(browser)
  process.stdout.write('done\ncapturing the on-page layer… ')
  await captureOverlay(browser)
  process.stdout.write('done\n')

  for (const slide of slides) {
    const out = await render(browser, { ...slide, name: `screenshots/${slide.name}` })
    console.log(`  ${out.replace(`${REPO}/`, '')}  ${slide.width}x${slide.height}`)
  }
  for (const spec of others) {
    const out = await render(browser, spec)
    console.log(`  ${out.replace(`${REPO}/`, '')}  ${spec.width}x${spec.height}`)
  }
} finally {
  await browser.close()
  server.close()
}

// The rendered pages are build intermediates; the PNGs are the deliverable. Left behind they
// make `.raw/` look like a source tree it is not — and they go stale the moment the layout
// changes, which is worse than absent.
for (const name of rendered) {
  await rm(join(RAW, `page-${name}.html`), { force: true })
}

/*
  The share card, into the place the site already points at.

  `apps/web/src/lib/site.ts` has declared `ogImage: '/og-default.png'` since the site was built
  and `apps/web/public/` has never held that file, so every link anyone has shared has rendered
  as a blank card. Copied rather than generated straight into `public/`, so the whole set stays
  reviewable in one directory and this is a visible last step rather than a side effect.
*/
await copyFile(join(HERE, 'social/og-1200x630.png'), join(REPO, 'apps/web/public/og-default.png'))
console.log('  apps/web/public/og-default.png  1200x630  (copied — site.ts already expects it)')

console.log('\nall assets written to store-assets/')
