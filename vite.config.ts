import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// The SPA always calls /api/*. Vite (dev) and server/server.mjs (prod) rewrite it to the
// Engram local runtime, so the browser stays on a single origin: the local API sends no
// CORS headers and rejects preflight, so direct cross-origin calls are impossible.
const engramUrl = process.env.ENGRAM_URL ?? 'http://127.0.0.1:7437'

const engramProxy = {
  target: engramUrl,
  rewrite: (path: string) => path.replace(/^\/api/, ''),
  ...(process.env.ENGRAM_HTTP_TOKEN
    ? { headers: { Authorization: `Bearer ${process.env.ENGRAM_HTTP_TOKEN}` } }
    : {}),
}

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: { '/api': engramProxy },
  },
})
