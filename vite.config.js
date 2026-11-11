import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { viteSingleFile } from 'vite-plugin-singlefile';

// base './' makes the built game work from any folder, including GitHub Pages.
//
// `vite build`               -> dist/: the website. A service worker keeps a copy of the game on the
//                               device after the first visit, so it opens instantly and plays offline.
// `vite build --mode single` -> dist/offline/: the whole game (code, styles, fonts) in ONE html file
//                               that can be shared on a USB stick or in a chat and opened by double-click.
// The font packages list a .woff fallback next to each .woff2. Every browser that runs the game reads woff2,
// so drop the fallback: it would otherwise be packed into the offline file twice over.
const woff2Only = {
  name: 'woff2-only',
  enforce: 'pre',
  transform(code, id) {
    if (id.includes('@fontsource') && id.endsWith('.css')) return code.replace(/,\s*url\([^)]*\.woff\) format\('woff'\)/g, '');
  },
};

export default defineConfig(({ mode }) => {
  if (mode === 'single') {
    return {
      base: './',
      plugins: [
        woff2Only,
        viteSingleFile(),
        // the single file has no folder of icons next to it, so drop the links to them
        { name: 'drop-icon-links', transformIndexHtml: (html) => html.replace(/<link rel="(icon|apple-touch-icon)"[^>]*>\n?/g, '') },
      ],
      build: { outDir: 'dist/offline', emptyOutDir: true, copyPublicDir: false },
    };
  }
  return {
    base: './',
    server: { open: true },
    plugins: [
      woff2Only,
      VitePWA({
        registerType: 'autoUpdate', // a new version is fetched in the background and used on the next visit
        injectRegister: 'script', // only registers the worker; never reloads the page in the middle of a game
        includeAssets: ['icon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'Mission Possible',
          short_name: 'Mission',
          description: 'A spiritual-battle maze game for children.',
          start_url: './',
          scope: './',
          display: 'standalone',
          background_color: '#1a1420',
          theme_color: '#1a1420',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
          globIgnores: ['offline/**', '**/mission-possible-offline.html'],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  };
});
