import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: { entry: resolve('src/main/index.ts') },
      rollupOptions: { external: ['better-sqlite3'] },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { lib: { entry: resolve('src/preload/index.ts') } },
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: { '@': resolve('src/renderer/src') },
    },
    root: 'src/renderer',
    build: { rollupOptions: { input: resolve('src/renderer/index.html') } },
  },
});
