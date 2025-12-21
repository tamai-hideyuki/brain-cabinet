import TinySegmenter from "tiny-segmenter";

const segmenter = new TinySegmenter();

/**
 * 日本語テキストを形態素（単語）に分割する
 * 例: "今日はプログラミングを勉強した" → ["今日", "は", "プログラミング", "を", "勉強", "し", "た"]
 */
export const tokenize = (text: string): string[] => {
  return segmenter.segment(text);
};

/**
 * トークン化してフィルタリング（短すぎるトークンを除外）
 */
export const tokenizeAndFilter = (
  text: string,
  minLength = 2
): string[] => {
  return tokenize(text).filter((t) => t.length >= minLength);
};
