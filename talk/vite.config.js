import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run dev` to edit with hot reload; `npm run build` writes dist/index.html
// with all JS/CSS inlined, so the talk opens from disk (file://) with no server
// and no network. Images and videos in public/ are copied next to it.
// The root is pinned to this file's folder, so the dev server also works when started from the repo root.
const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  base: './',
  plugins: [react(), viteSingleFile()],
})
