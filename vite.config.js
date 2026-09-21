import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  cacheDir: "/private/tmp/nz-counttale-vite-cache",
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    watch: {
      ignored: ["**/server/data/**"],
    },
  },
})
