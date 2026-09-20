import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createProjectsHandler } from './server/projects.mjs'

// The SPA always calls /api/*. Vite (dev) and server/server.mjs (prod) rewrite it to the
// Engram local runtime, so the browser stays on a single origin: the local API sends no
// CORS headers and rejects preflight, so direct cross-origin calls are impossible.
//
// /local/* is the exception: it is answered in-process, never proxied. `npm run dev` runs
// Vite alone (no server/server.mjs), so the same handler is mounted as middleware. Running
// from configureServer's hook body puts it ahead of Vite's internal proxy middleware, so
// /api proxying stays untouched.
const engramUrl = process.env.ENGRAM_URL ?? 'http://127.0.0.1:7437'

const engramProxy = {
  target: engramUrl,
  rewrite: (path: string) => path.replace(/^\/api/, ''),
  ...(process.env.ENGRAM_HTTP_TOKEN
    ? { headers: { Authorization: `Bearer ${process.env.ENGRAM_HTTP_TOKEN}` } }
    : {}),
}

const projectsPlugin: Plugin = {
  name: 'engram-local-projects',
  configureServer(server) {
    server.middlewares.use('/local/projects', createProjectsHandler())
  },
}

export default defineConfig({
  plugins: [vue(), projectsPlugin],
  server: {
    port: 5173,
    proxy: { '/api': engramProxy },
  },
})
