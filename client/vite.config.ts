import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-rc.png'],
      manifest: {
        name: 'A la source — Rouge Coquelicot',
        short_name: 'A la source',
        description: 'Outil d\'education populaire aux medias',
        theme_color: '#D91E2E',
        background_color: '#FEFDFB',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/logo-rc.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo-rc.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^\/api\/sources\/\d+$/,
            handler: 'NetworkFirst',
            options: { cacheName: 'sources-detail', expiration: { maxEntries: 50, maxAgeSeconds: 86400 } }
          },
          {
            urlPattern: /^\/api\/sources/,
            handler: 'NetworkFirst',
            options: { cacheName: 'sources-list', expiration: { maxEntries: 10, maxAgeSeconds: 3600 } }
          },
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 30, maxAgeSeconds: 3600 } }
          }
        ]
      }
    })
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3031',
      '/uploads': 'http://localhost:3031',
      '/images': 'http://localhost:3031',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
