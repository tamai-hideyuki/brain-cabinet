/**
 * ファイル名として安全な文字列に変換する
 * - OS非対応文字を除去
 * - スペースをハイフンに変換
 * - 連続ハイフンを単一に
 * - 先頭・末尾のハイフンを除去
 */
export const slugify = (text: string): string => {
  return text
    // OS非対応文字を除去 (Windows/Mac/Linux共通)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    // スペース・アンダースコアをハイフンに
    .replace(/[\s_]+/g, "-")
    // 連続ハイフンを単一に
    .replace(/-+/g, "-")
    // 先頭・末尾のハイフンを除去
    .replace(/^-+|-+$/g, "")
    // 空になった場合のフォールバック
    || "untitled";
};

/**
 * ファイルパスとして安全な文字列に変換
 * スラッシュは保持してディレクトリ構造を維持
 */
export const slugifyPath = (text: string): string => {
  return text
    .split("/")
    .map((segment) => slugify(segment))
    .join("/");
};
