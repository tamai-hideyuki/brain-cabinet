# Notionライク ブロックエディタ

> UI専用のNotionライクなブロックエディタ実装

---

## 概要

- **目的**: ノート詳細画面でNotionのような直感的な編集体験を提供
- **データ保存**: バックエンド変更なし。編集はブロック形式、保存時にMarkdownに変換
- **自動保存**: 1.5秒のデバウンス付き自動保存

---

## ディレクトリ構造

```
ui/src/
├── types/
│   └── block.ts                    # ブロック型定義
├── components/
│   ├── atoms/
│   │   └── BlockEditable/          # contenteditable ラッパー
│   ├── molecules/
│   │   ├── SlashCommandMenu/       # スラッシュコマンドメニュー
│   │   └── InlineFormatToolbar/    # インライン書式ツールバー
│   └── organisms/
│       └── BlockEditor/
│           ├── BlockEditor.tsx     # メインエディタ
│           ├── BlockEditor.css
│           ├── BlockEditorContext.tsx
│           ├── hooks/
│           │   ├── useBlockEditor.ts
│           │   ├── useSlashCommand.ts
│           │   ├── useBlockDragDrop.ts
│           │   └── useTextSelection.ts
│           ├── blocks/
│           │   ├── TextBlock.tsx
│           │   ├── HeadingBlock.tsx
│           │   ├── BulletListBlock.tsx
│           │   ├── NumberedListBlock.tsx
│           │   ├── ChecklistBlock.tsx
│           │   ├── CodeBlockEditor.tsx
│           │   ├── QuoteBlock.tsx
│           │   ├── ToggleBlock.tsx
│           │   ├── ImageBlock.tsx
│           │   ├── DividerBlock.tsx
│           │   ├── TableBlock.tsx
│           │   └── index.ts
│           └── utils/
│               ├── markdownToBlocks.ts
│               ├── blocksToMarkdown.ts
│               └── blockOperations.ts
```

---

## ブロックタイプ

| タイプ | 説明 | スラッシュコマンド |
|--------|------|------------------|
| `text` | テキスト | `/text` |
| `heading1` | 見出し1 | `/h1` |
| `heading2` | 見出し2 | `/h2` |
| `heading3` | 見出し3 | `/h3` |
| `bulletList` | 箇条書き | `/bullet` |
| `numberedList` | 番号付きリスト | `/number` |
| `checklist` | チェックリスト | `/todo` |
| `code` | コードブロック | `/code` |
| `quote` | 引用 | `/quote` |
| `toggle` | トグル | `/toggle` |
| `image` | 画像 | `/image` |
| `divider` | 区切り線 | `/divider` |
| `table` | テーブル | `/table` |

---

## キーボード操作

| キー | 動作 |
|------|------|
| `Enter` | 新しいブロック作成 / ブロック分割 |
| `Backspace` (先頭) | 前のブロックとマージ / テキストブロックに変換 |
| `Tab` | リストのインデント |
| `Shift+Tab` | リストのアウトデント |
| `↑/↓` | ブロック間移動 |
| `Cmd+B` | 太字 |
| `Cmd+I` | イタリック |
| `Cmd+S` | 保存 |
| `/` | スラッシュコマンドメニュー表示 |

---

## インライン書式

テキストを選択するとツールバーが表示され、以下の書式を適用可能:

| ボタン | 書式 | Markdown |
|--------|------|----------|
| **B** | 太字 | `**text**` |
| *I* | イタリック | `*text*` |
| `</>` | インラインコード | `` `text` `` |
| 🔗 | リンク | `[text](url)` |

### 技術実装

- `InlineFormatToolbar`: 選択時に表示されるフローティングツールバー
- `useTextSelection`: 選択範囲の検出フック
- `marks`: 各ブロックに `InlineMark[]` として書式情報を保持
- `applyMark` / `removeMark`: marksの追加・削除操作

---

## ドラッグ&ドロップ

- 各ブロックの左端にドラッグハンドル（⋮⋮）を表示
- ドラッグで並べ替え可能
- ドロップ位置にインジケーター表示

---

## 変換ロジック

### Markdown → Blocks (`markdownToBlocks.ts`)

- `unified` + `remark-parse` + `remark-gfm` でMarkdownをASTにパース
- ASTノードをBlockオブジェクトに変換
- インライン書式（bold, italic, code, link）をmarks配列に抽出

### Blocks → Markdown (`blocksToMarkdown.ts`)

- 各ブロックをMarkdown文字列に変換
- marksを適用して書式記号を挿入
- テーブル、トグル（`<details>`）など特殊形式に対応

---

## 使用箇所

### ノート詳細画面 (`NoteDetailPage`)

- `NoteDetail` コンポーネントに `BlockEditor` を統合
- 編集内容は1.5秒デバウンス後に自動保存
- 保存状態を「保存中...」「保存しました」で表示
- 「Markdown編集」ボタンで従来のテキストエリア編集も可能

---

## 型定義 (`ui/src/types/block.ts`)

```typescript
export type BlockType =
  | 'text' | 'heading1' | 'heading2' | 'heading3'
  | 'bulletList' | 'numberedList' | 'checklist'
  | 'code' | 'quote' | 'toggle'
  | 'image' | 'divider' | 'table'

export type MarkType = 'bold' | 'italic' | 'code' | 'link'

export interface InlineMark {
  type: MarkType
  start: number
  end: number
  url?: string
}

export interface BaseBlock {
  id: string
  type: BlockType
  indent: number
}

// 各ブロック型（TextBlock, HeadingBlock, etc.）
// Block = union of all block types
// EditorState = { blocks, focusedBlockId, cursorPosition, selectedBlockIds }
```

---

## 実装状況

| フェーズ | 内容 | 状態 |
|---------|------|------|
| Phase 1 | 基盤構築（型定義、変換、状態管理） | 完了 |
| Phase 2 | 基本ブロック（text, heading, divider, quote） | 完了 |
| Phase 3 | リストブロック（bullet, numbered, checklist） | 完了 |
| Phase 4 | インライン書式ツールバー | 完了（一部動作確認必要） |
| Phase 5 | 高度なブロック（code, image, toggle, table） | 完了 |
| Phase 6 | スラッシュコマンド＆ドラッグ | 完了 |
| Phase 7 | 詳細画面統合＆自動保存 | 完了 |

---

## 既知の制限・今後の課題

- インライン書式ツールバーのボタンクリック時の動作検証が必要
- 日本語IME入力時のEnter確定でブロックが消える問題は修正済み
- 番号付きリストの連番計算は同一インデントレベル内で正しく動作

---

最終更新: 2026-04-17
