# Markdownレンダリング実装マニュアル

このドキュメントでは、ReactアプリケーションでMarkdownを整形表示する実装方法を説明します。

## 概要

Brain Cabinet UIでは、ノートの内容がMarkdown形式で保存されています。これを`<pre>`タグでそのまま表示するのではなく、見出し・リスト・テーブルなどを適切にレンダリングするために、`react-markdown`ライブラリを使用しています。

## 使用ライブラリ

| ライブラリ | 用途 |
|-----------|------|
| `react-markdown` | MarkdownをReactコンポーネントに変換 |
| `remark-gfm` | GitHub Flavored Markdown（テーブル、取り消し線など）のサポート |

## インストール

```bash
cd ui
npm install react-markdown remark-gfm
```

## 実装手順

### 1. MarkdownContentコンポーネントの作成

`ui/src/components/atoms/MarkdownContent/` ディレクトリを作成し、以下のファイルを配置します。

#### MarkdownContent.tsx

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import './MarkdownContent.css'

type MarkdownContentProps = {
  content: string
  className?: string
}

export const MarkdownContent = ({ content, className = '' }: MarkdownContentProps) => {
  return (
    <div className={`markdown-content ${className}`.trim()}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
```

#### index.ts

```ts
export { MarkdownContent } from './MarkdownContent'
```

### 2. CSSスタイリング

`MarkdownContent.css` でMarkdown要素のスタイルを定義します。

```css
.markdown-content {
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--color-text);
}

/* 見出し */
.markdown-content h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 1.5rem 0 0.75rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--color-border);
}

.markdown-content h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 1.25rem 0 0.5rem;
}

.markdown-content h3 {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
}

/* 段落 */
.markdown-content p {
  margin: 0 0 0.75rem;
}

.markdown-content p:last-child {
  margin-bottom: 0;
}

/* リスト */
.markdown-content ul,
.markdown-content ol {
  margin: 0.5rem 0 0.75rem;
  padding-left: 1.5rem;
}

.markdown-content li {
  margin: 0.25rem 0;
}

/* コードブロック */
.markdown-content code {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  font-size: 0.875em;
  background: var(--color-bg-muted);
  padding: 0.125rem 0.375rem;
  border-radius: 4px;
}

.markdown-content pre {
  background: var(--color-bg-muted);
  border-radius: 6px;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  margin: 0.75rem 0;
}

.markdown-content pre code {
  background: none;
  padding: 0;
  font-size: 0.8125rem;
  line-height: 1.5;
}

/* 引用 */
.markdown-content blockquote {
  margin: 0.75rem 0;
  padding: 0.5rem 1rem;
  border-left: 3px solid var(--color-primary);
  background: var(--color-bg-surface);
  color: var(--color-text-muted);
}

/* テーブル */
.markdown-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.75rem 0;
  font-size: 0.875rem;
}

.markdown-content th,
.markdown-content td {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border);
  text-align: left;
}

.markdown-content th {
  background: var(--color-bg-muted);
  font-weight: 600;
}

/* リンク */
.markdown-content a {
  color: var(--color-primary);
  text-decoration: none;
}

.markdown-content a:hover {
  text-decoration: underline;
}
```

### 3. コンポーネントでの使用

```tsx
import { MarkdownContent } from '../../atoms/MarkdownContent'

// 使用例
<div className="note-detail__content">
  <MarkdownContent content={note.content} />
</div>
```

## remark-gfmの必要性

`react-markdown`単体では標準的なMarkdownのみをサポートします。GitHub Flavored Markdown（GFM）の機能を使うには`remark-gfm`プラグインが必要です。

### remark-gfmで有効になる機能

| 機能 | Markdown記法 | 例 |
|------|-------------|-----|
| テーブル | `\| --- \|` | 表形式のデータ |
| 取り消し線 | `~~text~~` | ~~取り消し~~ |
| タスクリスト | `- [ ]` / `- [x]` | チェックボックス |
| URLの自動リンク | `https://...` | URLをリンクに変換 |

### remark-gfmなしの場合

テーブルなどが生のMarkdownテキストとして表示されてしまいます：

```
| 用語 | 説明 |
|------|------|
| リージョン | AWSの地理的拠点 |
```

### remark-gfmありの場合

適切にテーブルとしてレンダリングされます。

## ディレクトリ構成

```
ui/src/components/atoms/MarkdownContent/
├── MarkdownContent.tsx   # メインコンポーネント
├── MarkdownContent.css   # スタイル定義
└── index.ts              # エクスポート
```

## 注意点

1. **バンドルサイズ**: react-markdownとremark-gfmを追加すると、約40KB程度バンドルサイズが増加します

2. **セキュリティ**: react-markdownはデフォルトでHTMLをエスケープするため、XSS攻撃に対して安全です

3. **シンタックスハイライト**: コードブロックにシンタックスハイライトを追加したい場合は、`rehype-highlight`または`react-syntax-highlighter`を別途導入してください

## 参考リンク

- [react-markdown](https://github.com/remarkjs/react-markdown)
- [remark-gfm](https://github.com/remarkjs/remark-gfm)
- [GitHub Flavored Markdown Spec](https://github.github.com/gfm/)
