#!/usr/bin/env node
/**
 * Opens the built extension folder in Finder and copies its path to the clipboard.
 *
 * Exists because `.output` is a dotfolder, and macOS hides those in file dialogs — so
 * Chrome's "Load unpacked" picker appears not to contain it at all. Revealing it in Finder
 * lets you drag it onto the dialog; the clipboard copy covers Cmd+Shift+G.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dir = fileURLToPath(new URL('../apps/extension/.output/chrome-mv3', import.meta.url))

if (!existsSync(dir)) {
  console.error('\nNot built yet. Run:  pnpm build:ext\n')
  process.exit(1)
}

console.log(`\n${dir}\n`)

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
console.log('  3. Cmd+Shift+G, paste the path above  — or drag the revealed folder in')
console.log('     (macOS hides dotfolders like .output; Cmd+Shift+. also toggles them)\n')
