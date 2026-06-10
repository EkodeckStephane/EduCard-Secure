import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['chart.js', 'react-chartjs-2'],
          mui: ['@emotion/react', '@emotion/styled', '@mui/material', '@mui/icons-material'],
          react: ['react', 'react-dom'],
          qr: ['qrcode.react', '@zxing/browser'],
          imageCrop: ['react-image-crop'],
          icons: ['lucide-react'],
          motion: ['framer-motion'],
          appCore: ['./src/api.ts', './src/i18n.ts', './src/ui/WorkflowComponents.tsx', './src/ui/DataTable.tsx'],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
