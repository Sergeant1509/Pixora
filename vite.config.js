import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, 'index.html'),
        signin: resolve(__dirname, 'signin.html'),
        signup: resolve(__dirname, 'signup.html')
      }
    }
  }
});
