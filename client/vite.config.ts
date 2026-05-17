import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
