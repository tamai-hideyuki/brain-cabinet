/**
 * GPT向けMarkdown正規化ユーティリティ
 * - 箇条書き整形
 * - 不要な空行削除
 * - コードブロック修復
 * - 見出しレベル統一
 */

// 不要な空行を削除（3行以上の連続空行を2行に）
const removeExcessiveBlankLines = (text: string): string => {
  return text.replace(/\n{3,}/g, "\n\n");
};

// 箇条書きの整形（インデント統一、マーカー統一）
const normalizeListItems = (text: string): string => {
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    // 箇条書きマーカーを統一（*、+、- → -）
    const listMatch = line.match(/^(\s*)[*+]\s+(.*)$/);
    if (listMatch) {
      const [, indent, content] = listMatch;
      result.push(`${indent}- ${content}`);
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
};

// コードブロックの修復（閉じ忘れを検出して修復）
const repairCodeBlocks = (text: string): string => {
  const lines = text.split("\n");
  const result: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";

  for (const line of lines) {
    const codeBlockStart = line.match(/^```(\w*)$/);
    const codeBlockEnd = line === "```";

    if (codeBlockStart && !inCodeBlock) {
      inCodeBlock = true;
      codeBlockLang = codeBlockStart[1];
      result.push(line);
    } else if (codeBlockEnd && inCodeBlock) {
      inCodeBlock = false;
      codeBlockLang = "";
      result.push(line);
    } else {
      result.push(line);
    }
  }

  // 閉じ忘れがあれば追加
  if (inCodeBlock) {
    result.push("```");
  }

  return result.join("\n");
};

// 見出しレベルの統一（#の後にスペースがない場合を修正）
const normalizeHeadings = (text: string): string => {
  return text.replace(/^(#{1,6})([^\s#])/gm, "$1 $2");
};

// 行頭・行末の余分な空白を削除
const trimLines = (text: string): string => {
  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
};

// リンクの整形（壊れたリンクを検出）
const repairLinks = (text: string): string => {
  // [text]( url ) → [text](url) の空白を削除
  return text.replace(/\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/g, "[$1]($2)");
};

/**
 * GPT向けにMarkdownを正規化
 */
export const normalizeMarkdown = (markdown: string): string => {
  let result = markdown;

  result = normalizeHeadings(result);
  result = normalizeListItems(result);
  result = repairCodeBlocks(result);
  result = repairLinks(result);
  result = removeExcessiveBlankLines(result);
  result = trimLines(result);

  return result;
};

/**
 * GPT向けに要約しやすい形式に変換
 * - 見出し構造を保持
 * - 箇条書きを維持
 * - コードブロックは簡略化
 */
export const formatForGPT = (markdown: string): string => {
  let result = normalizeMarkdown(markdown);

  // コードブロックを簡略化（長いコードは省略）
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    const lines = match.split("\n");
    if (lines.length > 15) {
      const lang = lines[0].replace("```", "");
      const preview = lines.slice(1, 8).join("\n");
      return `\`\`\`${lang}\n${preview}\n... (${lines.length - 2} lines)\n\`\`\``;
    }
    return match;
  });

  return result;
};

/**
 * 見出し構造を抽出（アウトライン生成）
 */
export const extractOutline = (markdown: string): string[] => {
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const outline: string[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const title = match[2].trim();
    const indent = "  ".repeat(level - 1);
    outline.push(`${indent}- ${title}`);
  }

  return outline;
};

/**
 * 箇条書きのみを抽出
 */
export const extractBulletPoints = (markdown: string): string[] => {
  const bulletRegex = /^[\s]*[-*+]\s+(.+)$/gm;
  const points: string[] = [];
  let match;

  while ((match = bulletRegex.exec(markdown)) !== null) {
    points.push(match[1].trim());
  }

  return points;
};
