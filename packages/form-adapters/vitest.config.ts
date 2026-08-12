import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // happy-dom rather than jsdom: much faster startup, and it implements the property
    // descriptors on HTMLInputElement.prototype that the React setter technique depends on.
    environment: 'happy-dom',
  },
})
