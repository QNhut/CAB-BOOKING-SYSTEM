import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || 'http://localhost:8000'

const proxyRoutes = [
  '/auth',
  '/internal',
  '/bookings',
  '/pricing',
  '/drivers',
  '/rides',
  '/users',
  '/notifications',
  '/geo',
  '/payment',
  '/payments',
  '/eta',
  '/fraud',
  '/review',
  '/reviews',
  '/agent',
  '/ai',
]

const proxy = Object.fromEntries(
  proxyRoutes.map((route) => [
    route,
    {
      target: API_PROXY_TARGET,
      changeOrigin: true,
    },
  ])
)

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy,
  },
})
