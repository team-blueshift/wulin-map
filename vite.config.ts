import { defineConfig } from 'vite';

export default defineConfig({
  // 커스텀 도메인 루트 (https://murimap.com/)
  base: '/',
  server: {
    port: 5180,
    host: true,  // LAN 접근 허용 (iPhone Safari 디버깅 등)
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
