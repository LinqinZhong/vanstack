import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@vanstack/shared': path.resolve(rootDir, '../../packages/shared/src/index.ts'),
      '@vanstack/xml': path.resolve(rootDir, '../../packages/xml/src/index.ts'),
      '@vanstack/lowcode-runtime': path.resolve(rootDir, '../../packages/lowcode-runtime/src/index.ts'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3010',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4174,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3010',
        changeOrigin: true,
      },
    },
  },
});
