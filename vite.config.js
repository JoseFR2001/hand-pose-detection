import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@mediapipe/hands': path.resolve(__dirname, './src/mediapipe-hands-shim.js')
    }
  }
});
