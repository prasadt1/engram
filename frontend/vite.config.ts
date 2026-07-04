import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true,
      },
      // LocalDiskStorage.signed_url() returns a relative /media/{key} path
      // (no host, unlike OSSStorage's presigned URL). In dev the frontend
      // origin is :5173, so without this proxy <img src="/media/...">
      // resolves against Vite itself and 404s. Production is unaffected —
      // there the app is served same-origin with the API (see deploy plan).
      '/media': 'http://localhost:8000',
    },
  },
})
