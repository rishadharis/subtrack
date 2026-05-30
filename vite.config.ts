import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      $lib: resolve(__dirname, './src/lib'),
    },
  },
  plugins: [
    svelte(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Subtrack',
        short_name: 'Subtrack',
        description: 'Pelacak langganan digital pribadi — ringan, cepat, sepenuhnya lokal. Data disimpan di file .subtrack milik Anda.',
        theme_color: '#0ea5e9',
        background_color: '#f8fafc',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        // NOTE: Real icons (192/512 png) will be added in Task 12 for production PWA installability
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
