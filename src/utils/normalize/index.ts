/**
 * GPT向けにMarkdownテキストを正規化
 * - 行頭記号削除（リスト、見出し、引用）
 * - コードブロック除去
 * - URL除去（optional）
 * - 改行→半角スペース
 * - 空白圧縮
 */
export const normalizeText = (md: string, options?: { removeUrls?: boolean }): string => {
  let text = md
    // コードブロック除去
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]+`/g, "")
    // 行頭リスト記号
    .replace(/^\s*[-*+]\s+/gm, "")
    // チェックボックス
    .replace(/^\s*\[[ x]\]\s*/gim, "")
    // 見出し
    .replace(/^#{1,6}\s+/gm, "")
    // 引用
    .replace(/^>\s*/gm, "")
    // 太字・斜体
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // リンク [text](url) → text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // 画像 ![alt](url) → 削除
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "");

  // URL除去（オプション）
  if (options?.removeUrls) {
    text = text.replace(/https?:\/\/[^\s]+/g, "");
  }

  // 改行→スペース、空白圧縮
  return text
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * GPT用に完全正規化（URL除去あり）
 */
export const normalizeForGPT = (md: string): string => {
  return normalizeText(md, { removeUrls: true });
};
