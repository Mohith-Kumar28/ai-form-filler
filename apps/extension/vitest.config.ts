import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // Generated code is a build artifact and carries no tests worth collecting.
    exclude: [
      '**/node_modules/**',
      '**/build/**',
      '**/.output/**',
      '**/.wxt/**',
      '**/src/generated/**',
    ],
  },
})
