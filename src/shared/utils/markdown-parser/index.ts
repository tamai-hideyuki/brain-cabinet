/**
 * Markdownファイルを解析してFrontmatterと本文を抽出する
 */

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
  raw: string;
}

/**
 * Frontmatterを含むMarkdownをパース
 */
export const parseMarkdown = (content: string): ParsedMarkdown => {
  const raw = content;

  // Frontmatter区切りをチェック
  if (!content.startsWith("---")) {
    return { frontmatter: {}, body: content.trim(), raw };
  }

  // 2つ目の --- を探す
  const endIndex = content.indexOf("\n---", 3);
  if (endIndex === -1) {
    return { frontmatter: {}, body: content.trim(), raw };
  }

  const frontmatterStr = content.slice(4, endIndex).trim();
  const body = content.slice(endIndex + 4).trim();

  // YAMLを簡易パース
  const frontmatter = parseYamlSimple(frontmatterStr);

  return { frontmatter, body, raw };
};

/**
 * 簡易YAMLパーサー（ライブラリ不要）
 * - key: value 形式
 * - key:\n  - item 形式（配列）
 */
const parseYamlSimple = (yaml: string): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  const lines = yaml.split("\n");

  let currentKey: string | null = null;
  let currentArray: string[] | null = null;

  for (const line of lines) {
    // 配列アイテム
    if (line.match(/^\s+-\s+/)) {
      if (currentKey && currentArray) {
        const value = line.replace(/^\s+-\s+/, "").trim();
        // クォートを除去
        currentArray.push(value.replace(/^["']|["']$/g, ""));
      }
      continue;
    }

    // 配列が終了したら保存
    if (currentKey && currentArray) {
      result[currentKey] = currentArray;
      currentKey = null;
      currentArray = null;
    }

    // key: value または key:
    const match = line.match(/^(\w+):\s*(.*)$/);
    if (match) {
      const [, key, value] = match;

      if (value === "" || value === undefined) {
        // 配列の開始
        currentKey = key;
        currentArray = [];
      } else {
        // 単純なkey-value
        result[key] = value.replace(/^["']|["']$/g, "");
      }
    }
  }

  // 最後の配列を保存
  if (currentKey && currentArray) {
    result[currentKey] = currentArray;
  }

  return result;
};

/**
 * Frontmatterからノート比較用のデータを抽出
 */
export interface MarkdownNoteData {
  id: string | null;
  title: string | null;
  content: string;
  category: string | null;
  tags: string[];
  updatedAt: string | null;
}

export const extractNoteData = (parsed: ParsedMarkdown): MarkdownNoteData => {
  const { frontmatter, body } = parsed;

  return {
    id: (frontmatter.id as string) || null,
    title: (frontmatter.title as string) || null,
    content: body,
    category: (frontmatter.category as string) || null,
    tags: (frontmatter.tags as string[]) || [],
    updatedAt: (frontmatter.updated_at as string) || null,
  };
};
