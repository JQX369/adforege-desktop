/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { viteStaticCopy } from 'vite-plugin-static-copy'

declare module 'vite' {
  interface UserConfig {
    test?: import('vitest/config').UserConfig['test']
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Copy PDF.js worker to dist for runtime loading
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs',
          dest: 'assets',
          rename: 'pdf.worker.min.mjs'
        }
      ]
    })
  ],
  base: './',
  server: {
    port: 5173,
    open: false, // Do not open browser automatically (we use Electron or manual open)
    host: '127.0.0.1', // Listen on localhost
    strictPort: true, // Fail fast if 5173 is in use so Electron + Vite stay in sync
  },
  resolve: {
    alias: {
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  optimizeDeps: {
    // Exclude pdfjs-dist from optimization to prevent worker issues
    exclude: ['pdfjs-dist']
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    css: true,
  },
})
