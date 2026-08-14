import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

/**
 * A standalone build for the review gallery.
 *
 * Separate from WXT on purpose: WXT bundles `src/entrypoints`, so nothing here can leak into
 * the shipped extension, and this needs a plain `index.html` that headless Chrome can open
 * from disk rather than a `chrome-extension://` page behind a signed-in session.
 */
export default defineConfig({
  root: import.meta.dirname,
  // Relative, so the built page opens over file:// with no server.
  base: './',
  // The extension's `public/`, so the gallery renders in the real bundled faces rather than
  // silently falling back to the system stack — which would review a different typeface.
  publicDir: '../public',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../.gallery',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Two harnesses: the panel's screens, and the layer that lands on someone else's page.
        index: resolve(import.meta.dirname, 'index.html'),
        overlay: resolve(import.meta.dirname, 'overlay.html'),
      },
    },
  },
})
