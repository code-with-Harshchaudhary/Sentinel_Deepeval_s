import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command, mode }) => {
  const apiUrl = loadEnv(mode, '.', '').VITE_API_URL?.trim().replace(/\/+$/, '');
  if (command === 'build' && !apiUrl) {
    throw new Error('VITE_API_URL is required for production builds.');
  }
  if (command === 'build' && apiUrl !== '/api' && !/^https:\/\/.+\/api$/.test(apiUrl ?? '')) {
    throw new Error('VITE_API_URL must be /api or an HTTPS URL ending in /api.');
  }

  return {
    plugins: [react(), tailwindcss()],
    build: {
      // Route modules and charts are already lazy-loaded; this budget covers the shared UI runtime.
      chunkSizeWarningLimit: 550,
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:8000',
      },
    },
  };
});
