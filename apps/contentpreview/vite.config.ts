import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/contentpreview-app/',
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  build: {
    // This dedicated generated directory contains only the preview, never website files.
    outDir: '../../public/contentpreview-app',
    emptyOutDir: true,
    sourcemap: false,
  },
});
