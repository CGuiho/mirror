/// <reference types="vitest/config" />

import tsconfigPaths from 'vite-tsconfig-paths'

import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: { cssMinify: true, ssr: false },
  test: {
    
  },
})
