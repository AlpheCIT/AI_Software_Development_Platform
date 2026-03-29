import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['p1gen6', 'p1gen6.local', 'localhost'],
    proxy: {
      '/qa': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3005',
        ws: true,
        changeOrigin: true,
      },
      '/api/v1/qa': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@chakra-ui/react', '@emotion/react', '@emotion/styled'],
          graph: ['@antv/graphin', '@antv/g6'],
          utils: ['lodash', 'date-fns'],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@chakra-ui/react',
      '@antv/graphin',
      'lodash',
    ],
  },
});
