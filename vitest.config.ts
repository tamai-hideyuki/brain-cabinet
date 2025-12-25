import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'ui/**'],
    // DBクライアントをモックしてテスト時のSQLite競合を防ぐ
    setupFiles: ['./vitest.setup.ts'],
  },
})
