/**
 * ノートデータをMarkdown形式に変換する
 */

interface NoteData {
  id: string;
  title: string;
  path: string;
  content: string;
  tags: string | null;
  category: string | null;
  headings: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Unix timestamp を ISO 8601 形式に変換
 */
const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toISOString();
};

/**
 * JSON文字列を配列にパース（安全に）
 */
const parseJsonArray = (jsonStr: string | null): string[] => {
  if (!jsonStr) return [];
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * YAML Frontmatter を生成
 */
const generateFrontmatter = (note: NoteData): string => {
  const tags = parseJsonArray(note.tags);
  const headings = parseJsonArray(note.headings);

  const lines: string[] = ["---"];

  // 必須フィールド
  lines.push(`id: ${note.id}`);
  lines.push(`title: "${note.title.replace(/"/g, '\\"')}"`);

  // カテゴリ
  if (note.category) {
    lines.push(`category: ${note.category}`);
  }

  // タグ（YAML配列形式）
  if (tags.length > 0) {
    lines.push("tags:");
    tags.forEach((tag) => {
      lines.push(`  - ${tag}`);
    });
  }

  // 見出し（参照用）
  if (headings.length > 0) {
    lines.push("headings:");
    headings.forEach((heading) => {
      lines.push(`  - "${heading.replace(/"/g, '\\"')}"`);
    });
  }

  // 日時
  lines.push(`created_at: ${formatDate(note.createdAt)}`);
  lines.push(`updated_at: ${formatDate(note.updatedAt)}`);

  // 元のパス（参照用）
  lines.push(`source_path: "${note.path}"`);

  lines.push("---");

  return lines.join("\n");
};

/**
 * Markdown本文を生成
 * - contentがすでにタイトルを含むか判定
 * - 含まない場合はH1タイトルを追加
 */
const generateBody = (note: NoteData): string => {
  const content = note.content.trim();

  // 先頭がH1で始まるかチェック
  const startsWithH1 = /^#\s+/.test(content);

  if (startsWithH1) {
    return content;
  }

  // H1タイトルを追加
  return `# ${note.title}\n\n${content}`;
};

/**
 * ノートをMarkdown形式に変換
 */
export const formatNoteAsMarkdown = (note: NoteData): string => {
  const frontmatter = generateFrontmatter(note);
  const body = generateBody(note);

  return `${frontmatter}\n\n${body}\n`;
};

/**
 * エクスポート先のファイルパスを生成
 * category/slugified-title.md の形式
 */
export const generateExportPath = (
  note: NoteData,
  slugify: (text: string) => string
): string => {
  const category = note.category || "uncategorized";
  const filename = slugify(note.title) + ".md";

  return `${category}/${filename}`;
};
