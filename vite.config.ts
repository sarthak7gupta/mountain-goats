import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base path for GitHub Pages - change to '/' if deploying to root (username.github.io)
// or '/repository-name/' if deploying to project page (username.github.io/repository-name)
const base = process.env.VITE_BASE_PATH || '/mountain-goats/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
});
