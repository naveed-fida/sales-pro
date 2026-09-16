import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = resolve(__dirname, 'src/shared')
const renderer = resolve(__dirname, 'src/renderer')

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': shared },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@shared': shared },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer/src'),
        '@shared': shared,
      },
    },
    build: {
      // electron-vite defaults minify to false, unlike plain Vite. Main and
      // preload stay readable for legible production stack traces, but the
      // renderer ships to users and should be minified.
      minify: 'esbuild',
      rollupOptions: {
        input: {
          index: resolve(renderer, 'index.html'),
          receipt: resolve(renderer, 'receipt.html'),
        },
      },
    },
  },
})
