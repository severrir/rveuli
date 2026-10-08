import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * `base` is set by CI from the repository name, because a GitHub Pages
 * project site is served from /<repo>/ rather than the domain root. It
 * defaults to "/" so local dev, a user page and a custom domain all work.
 */
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), tailwindcss()],
})
