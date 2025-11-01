import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Web-only build configuration (for Docker deployment)
export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/renderer'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true
  }
})
