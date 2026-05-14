import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages 배포 경로 (https://team-blueshift.github.io/wulin-map/)
  base: '/wulin-map/',
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
