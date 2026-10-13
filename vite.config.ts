import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [react(), legacy({targets:['ios >= 12','safari >= 12'],modernTargets:['ios >= 12','safari >= 12'],modernPolyfills:true}), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icon.svg', 'apple-touch-icon.png'],
    manifest: {
      name: 'Shalom · Partituras', short_name: 'Shalom', lang: 'pt-BR',
      description: 'O repertório da banda Shalom, em todos os tablets.',
      theme_color: '#f6f7fb', background_color: '#f6f7fb', display: 'standalone',
      orientation: 'any', start_url: '/',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    },
    workbox: { globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2}'], maximumFileSizeToCacheInBytes: 6000000,
      navigateFallbackDenylist: [/^\/api/], cleanupOutdatedCaches: true }
  })],
  build: { rollupOptions: { output: { manualChunks: { 'pdf-reader': ['pdfjs-dist/legacy/build/pdf.mjs'], 'pdf-tools': ['pdf-lib'] } } } },
  worker:{format:'iife',plugins:()=>[{name:'safari12-pdf-worker',enforce:'post',renderChunk:async code=>(await transformWithEsbuild(code,'pdf-worker.js',{target:'es2018'})).code}]},
  server: { port: 5173 }
});
