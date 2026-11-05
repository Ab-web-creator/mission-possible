import { defineConfig } from 'vite';

// base './' makes the built game work from any folder, including GitHub Pages.
export default defineConfig({
  base: './',
  server: { open: true },
});
