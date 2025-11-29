- メモ作成
- pnpm import-notes ./notes
- curl "http://localhost:3000/api/search?query=test"
- curl "http://localhost:3000/api/notes/{noteId}/history"
- curl -s "http://localhost:3000/api/notes/bbf22250-58d0-451e-acc1-f312bc865381/history" | jq .


# ファイル編集後にインポート（diffが保存される）
pnpm import-notes notes

# 履歴確認
- curl "http://localhost:3000/api/notes/{noteId}/history"

# HTML diff取得
- curl "http://localhost:3000/api/notes/{noteId}/history/{historyId}/diff"

# 巻き戻し
- curl -X POST "http://localhost:3000/api/notes/{noteId}/revert/{historyId}"


```
brain-cabinet/
├── src/
│   ├── db/
│   │   ├── schema.ts        # SQLiteのテーブル定義
│   │   └── client.ts        # DB接続
│   ├── routes/
│   │   ├── notes.ts         # /api/notes のエンドポイント
│   │   └── search.ts        # /api/search のエンドポイント
│   ├── services/
│   │   ├── notesService.ts  # ビジネスロジック（まとめる層）
│   │   └── searchService.ts
│   ├── repositories/
│   │   ├── notesRepo.ts     # DBアクセス層（生SQLを書く層）
│   │   └── searchRepo.ts
│   ├── importer/
│   │   └── import-notes.ts  # CLIでメモを流し込むスクリプト
│   └── index.ts             # Honoアプリのエントリーポイント
│
├── drizzle.config.ts        # Drizzleの設定
├── package.json
├── tsconfig.json
├── .gitignore
└── README.md

```


- 情報取得（Input系）

| 目的             | API                                  | 
| -------------- | ------------------------------------ |
| キーワード検索        | GET /api/search                      |
| タグ検索           | GET /api/search?tags=                |
| ノート全文 + 履歴     | GET /api/notes/:id/full-context      |
| 履歴のHTML差分      | GET /api/notes/:id/history/:hid/diff |
| 履歴一覧           | GET /api/notes/:id/history           |
| 軽量履歴           | GET /api/notes/:id/with-history      |
| カテゴリ一覧         | GET /api/search/categories           |
| GPT向け複合検索      | GET /api/gpt/search                  |
| GPT向けノートコンテキスト | GET /api/gpt/notes/:id/context       |
| GPT全体サマリー      | GET /api/gpt/overview                |

- 状態変更（Write系）

| 目的     | API                             |
| ------ | ------------------------------- |
| ノート更新  | PUT /api/notes/:id              |
| 巻き戻し   | POST /api/notes/:id/revert/:hid |
| GPTタスク | POST /api/gpt/task              |
