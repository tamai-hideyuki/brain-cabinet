- メモ作成
- pnpm import-notes ./notes
- curl "http://localhost:3000/api/search?query=test"


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