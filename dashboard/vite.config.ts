import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local: base "/"
// GitHub Pages: VITE_BASE=/DeductionAnalysisTool/ (set in the deploy workflow)
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  optimizeDeps: {
    include: ['plotly.js-dist-min', 'react-plotly.js', 'react-pivottable'],
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          plotly: ['plotly.js-dist-min', 'react-plotly.js'],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
