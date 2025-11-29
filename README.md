- メモ作成
- pnpm import-notes ./notes
- curl "http://localhost:3000/api/search?query=test"
- curl "http://localhost:3000/api/notes/{noteId}/history"
- curl -s "http://localhost:3000/api/notes/bbf22250-58d0-451e-acc1-f312bc865381/history" | jq .


- 現状のアルゴリズム
- 検索ワードがたくさん含まれるほどスコアが上がる（メモの長さ（内容量）に比例して高くなる）
- タイトル一致の重みは小さい（内容が多いものが勝つ）
- snippet もちゃんと先頭から取れてる（ユーザーが見たときの UI としてとても自然）

- 現状DB
- createdAt
- updatedAt
- content
- path
- snippet

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