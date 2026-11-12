import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Куда дев-прокси проксирует REST-запросы (обходит CORS на localhost).
const API_PROXY_TARGET = 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Кеш Figma и временные браузерные файлы не участвуют в HMR.
    watch: {
      ignored: ['**/.figma/**'],
    },
    // Локально держим VITE_API_BASE_URL пустым — запросы идут на /api того же
    // origin и проксируются на бэкенд, поэтому браузер не упирается в CORS.
    proxy: {
      '/api': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        secure: true,
      },
      // WebSocket (SockJS/STOMP) чата поддержки — проксируем с апгрейдом ws.
      '/ws': {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        secure: true,
        ws: true,
        // The local backend accepts http://localhost:8080 as its WS Origin.
        rewriteWsOrigin: true,
      },
    },
  },
})
