import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // テスト対象外とするディレクトリ群
    // - node_modules
    // - dist: ビルド・依存物
    // - ui: フロントエンド（Vitest 対象外）
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'ui/**',
      '**/whisper.cpp/**'
    ],

    // テスト起動前に DB クライアントをモックする
    // SQLite は並列テスト時にロック競合を起こしやすいため、
    // 実 DB を使用しない構成に統一する
    setupFiles: ['./vitest.setup.ts'],
  },
})
