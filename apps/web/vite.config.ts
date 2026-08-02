import { fileURLToPath } from 'node:url';
// vitest/config re-exports vite's defineConfig and adds the `test` key, so one
// config serves `vite build`, `vite dev` and `vitest run`.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// @booking/core is published as CommonJS for apps/api. Aliasing the browser build
// to its TypeScript source skips the CJS interop and the core-must-build-first
// ordering that would otherwise apply in dev.
const coreSrc = fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url));

// Dev-only: `npm run dev:web` proxies /api to `npm run dev:api`, whose default
// PORT is 3000 (see .env.example). Production serves both from one process.
const API_DEV_ORIGIN = 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@booking/core': coreSrc },
  },
  server: {
    proxy: { '/api': { target: API_DEV_ORIGIN, changeOrigin: false } },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
  },
});
