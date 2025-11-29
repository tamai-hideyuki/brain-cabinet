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

- 後から設計図
```
src/
  domain/
    note/
      Note.ts
      NoteId.ts
      NoteRepository.ts (interface)
      NoteService.ts
  application/
    getNoteList/
    searchNote/
    importNotes/
  infrastructure/
    db/
      NoteRepositoryImpl.ts
    vector/
      ChromaAdapter.ts
  interfaces/
    http/
      routes/
```