#!/usr/bin/env node
/**
 * Opens the built extension folder in Finder and copies its path to the clipboard.
 *
 * The build output used to live in `.output/`, which macOS Finder and Chrome's "Load
 * unpacked" picker both hide — the folder looked absent rather than hidden. It is now
 * `apps/extension/build/` (see `outDir` in wxt.config.ts), so this script is a shortcut
 * rather than a workaround: it saves finding the path and picks the right one of the two
 * build folders for you.
 *
 * Prefers the dev build, because that is the one `pnpm dev` keeps live-reloading and so the
 * one you want loaded while working. Falls back to the production build.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const candidates = [
  ['dev', new URL('../apps/extension/build/chrome-mv3-dev', import.meta.url)],
  ['production', new URL('../apps/extension/build/chrome-mv3', import.meta.url)],
]

const found = candidates.find(([, url]) => existsSync(fileURLToPath(url)))

if (!found) {
  console.error('\nNot built yet. Run:  pnpm dev:ext   (live-reloading)')
  console.error('               or:  pnpm build:ext  (one-off)\n')
  process.exit(1)
}

const [which, url] = found
const dir = fileURLToPath(url)

console.log(`\n${dir}\n(${which} build)\n`)

/**
 * `pnpm zip` overwrites `build/chrome-mv3` with a store build, which has `key` stripped —
 * the Web Store refuses a manifest that carries it. Loading that folder unpacked gets a
 * path-derived extension ID instead of the pinned one, and Google sign-in fails with a
 * mismatched `aud` rather than with anything that mentions the ID. Cheap to detect here,
 * expensive to diagnose later.
 */
try {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf-8'))
  if (!manifest.key) {
    console.log('⚠  This build has no `key` — it is the store artifact left behind by `pnpm zip`.')
    console.log('   Its extension ID will not be the pinned one, so sign-in will fail.')
    console.log('   Run `pnpm build:ext` (or `pnpm dev:ext`) before loading it.\n')
  }
} catch {
  // No readable manifest is a broken build, which the build command itself will report.
}

if (process.platform === 'darwin') {
  try {
    execFileSync('pbcopy', { input: dir })
    console.log('Copied to clipboard.\n')
  } catch {
    // Clipboard is a convenience; the path is printed above regardless.
  }
  try {
    execFileSync('open', ['-R', dir])
  } catch {
    // Finder may be unavailable in a headless session.
  }
}

console.log('In Chrome:')
console.log('  1. chrome://extensions  →  enable Developer mode (top right)')
console.log('  2. Load unpacked')
console.log('  3. Cmd+Shift+G, paste the path above  — or drag the revealed folder in\n')
