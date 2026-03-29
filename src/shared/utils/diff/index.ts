import { diff_match_patch } from "diff-match-patch";

const dmp = new diff_match_patch();

/** 差分パッチを生成（保存用） */
export const computeDiff = (oldText: string, newText: string): string => {
  const patches = dmp.patch_make(oldText, newText);
  return dmp.patch_toText(patches);
};

/** HTML形式の差分を生成（表示用） */
export const computeHtmlDiff = (oldText: string, newText: string): string => {
  const diffs = dmp.diff_main(oldText, newText);
  dmp.diff_cleanupSemantic(diffs);
  return dmp.diff_prettyHtml(diffs);
};
