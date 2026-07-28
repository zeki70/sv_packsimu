import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages: サイトは https://<user>.github.io/sv_packsimu/ 配下に出る。
// 独自ドメインを使うようになったら '/' に変更する。
export default defineConfig({
  base: '/sv_packsimu/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
