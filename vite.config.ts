import { defineConfig } from 'vite';

export default defineConfig({
  // 커스텀 도메인 루트 (https://murimap.com/)
  base: '/',
  server: {
    port: 5180,
    host: '127.0.0.1',
  },
  assetsInclude: ['**/*.yaml'],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        compare: 'compare.html',
      },
    },
  },
});
