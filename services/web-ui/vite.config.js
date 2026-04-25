import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pantryPal.png', 'palstack.png'],
      manifest: {
        name: 'PantryPal',
        short_name: 'PantryPal',
        description: 'Smart pantry management',
        theme_color: '#d97706',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/pantryPal.png', sizes: '192x192', type: 'image/png' },
          { src: '/pantryPal.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          // ── Read requests: serve from network, fall back to cache ──────────
          {
            urlPattern: /^\/api\/.*/i,
            method: 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-get-cache',
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
              networkTimeoutSeconds: 5,
            },
          },
          // ── Write mutations: network-only, queue when offline ──────────────
          // Covers: POST/PUT/PATCH/DELETE on /api/items and /api/shopping-list
          {
            urlPattern: /^\/api\/(items|shopping-list)(\/.*)?$/i,
            method: 'POST',
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'mutations-queue',
                options: { maxRetentionTime: 24 * 60 }, // 24 hours in minutes
              },
            },
          },
          {
            urlPattern: /^\/api\/(items|shopping-list)(\/.*)?$/i,
            method: 'PUT',
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'mutations-queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            urlPattern: /^\/api\/(items|shopping-list)(\/.*)?$/i,
            method: 'PATCH',
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'mutations-queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
          {
            urlPattern: /^\/api\/(items|shopping-list)(\/.*)?$/i,
            method: 'DELETE',
            handler: 'NetworkOnly',
            options: {
              backgroundSync: {
                name: 'mutations-queue',
                options: { maxRetentionTime: 24 * 60 },
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://api-gateway:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
