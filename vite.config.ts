import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Educa Admin',
        short_name: 'Educa Admin',
        description: 'School administration for Educa: exams, marks, report cards and school set-up.',
        theme_color: '#1e3a8a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. School data is children's personal data: it is never
        // written to a cache a shared or lost device could give up.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') || url.pathname.includes('/api/'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    // Long-lived vendor chunks: an app update re-downloads only the app code.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/](react|react-dom|scheduler|react-router)[\\/]/.test(id)) return 'react'
          if (/[\\/](radix-ui|@radix-ui|cmdk|sonner|next-themes|lucide-react)[\\/]/.test(id)) return 'ui'
          if (/[\\/](@tanstack|react-hook-form|@hookform|zod)[\\/]/.test(id)) return 'data'
          if (/[\\/]@capacitor[\\/]/.test(id)) return 'capacitor'
          return 'vendor'
        },
      },
    },
  },
  server: {
    // Reachable from a phone or emulator on the LAN during development.
    host: true,
    port: 5173,
    // Without this, a busy 5173 sends the admin app to 5174 — the staff
    // portal's port — and the portal then cannot start.
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
