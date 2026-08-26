import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Local: base "/"
// GitHub Pages: VITE_BASE=/DeductionAnalysisTool/ (set in the deploy workflow)
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
  },
});
