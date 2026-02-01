import pino from "pino";

const log = pino({ name: "refine-service" });

/**
 * Whisperの生テキストを整理する（LLM不使用・ローカル処理のみ）
 *
 * - Whisperの幻聴パターン除去
 * - 重複フレーズ除去
 * - 連続セグメントの自然な結合
 */

// Whisperがよく出す幻聴・ノイズパターン
const NOISE_PATTERNS = [
  /^\[.*?\]$/,                    // [音楽], [拍手] 等
  /^ご視聴ありがとうございました[。！]?$/,
  /^ありがとうございました[。！]?$/,
  /^チャンネル登録.*$/,
  /^字幕.*$/,
  /^\.+$/,                        // "..." のみ
  /^，+$/,                        // "，，，" のみ
  /^、+$/,
];

function isNoise(text: string): boolean {
  const trimmed = text.trim();
  return NOISE_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * 連続する重複テキストを除去
 * Whisperは同じフレーズを繰り返し出力することがある
 */
function dedup(texts: string[]): string[] {
  const result: string[] = [];
  for (const t of texts) {
    const last = result[result.length - 1];
    if (last === t) continue;
    // 部分重複: 前のテキストの末尾と今のテキストの先頭が重なるケース
    if (last && t.startsWith(last.slice(-10)) && last.slice(-10).length >= 5) {
      result[result.length - 1] = last + t.slice(last.slice(-10).length);
      continue;
    }
    result.push(t);
  }
  return result;
}

/**
 * セグメント群を受け取り、整理済みテキストを返す
 */
export function refineSegments(
  segments: { text: string; timestamp: number }[]
): string {
  // 1. ノイズ除去
  const cleaned = segments
    .map((s) => s.text.trim())
    .filter((t) => t.length > 0 && !isNoise(t));

  // 2. 重複除去
  const deduped = dedup(cleaned);

  // 3. 句点で結合（自然な文章に）
  const merged = deduped.map((t) => {
    // 末尾に句読点がなければ追加
    if (!/[。．.！？!?]$/.test(t)) {
      return t + "。";
    }
    return t;
  });

  const result = merged.join("");
  log.info({ inputCount: segments.length, outputLength: result.length }, "Refined text");
  return result;
}
