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
      includeAssets: ['favicon.svg', 'pwa-192x192.jpg', 'pwa-512x512.jpg'],
      manifest: {
        name: 'Subtrack',
        short_name: 'Subtrack',
        description: 'Pelacak langganan digital pribadi — ringan, cepat, sepenuhnya lokal. Data disimpan di file .subtrack milik Anda.',
        lang: 'id',
        theme_color: '#0ea5e9',
        background_color: '#f8fafc',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        scope: '/',
        start_url: '/',
        orientation: 'any',
        icons: [
          {
            src: '/pwa-192x192.jpg',
            sizes: '192x192',
            type: 'image/jpeg',
          },
          {
            src: '/pwa-512x512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,jpg}'],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
