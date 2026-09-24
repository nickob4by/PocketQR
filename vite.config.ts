import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.ico',
        'apple-touch-icon.png',
        'pwa-192x192.png',
        'pwa-512x512.png',
        'logo.svg',
      ],
      manifest: {
        name: 'PocketQR - Philippine QR Ph Wallet',
        short_name: 'PocketQR',
        description: 'Instant, offline-first presentation of Philippine QR Ph payment codes (GCash, Maya, RCBC, and banks) for all phones and tablets.',
        theme_color: '#0a0f1d',
        background_color: '#0a0f1d',
        display: 'standalone',
        orientation: 'any', // Enables fluid rotation on tablets, foldables, and landscape phone mounts
        categories: ['finance', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
      },
    }),
  ],
});
