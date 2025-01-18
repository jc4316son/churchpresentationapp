import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true,
        secure: false,
        changeOrigin: true,
        rewrite: (path) => path
      }
    },
    headers: {
      'Content-Security-Policy': "default-src 'self'; connect-src 'self' ws: wss: http: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    }
  },
  preview: {
    port: 4173,
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3001',
        ws: true,
        secure: false,
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  },
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          socket: ['socket.io-client']
        }
      }
    }
  }
});