import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base is required: the Capacitor WebView loads from file://-like origins.
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 4096,
    sourcemap: false,
  },
  server: {
    host: true,
    port: 5173,
  },
});
