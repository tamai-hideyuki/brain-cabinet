import pino from "pino";
import { listNoisePatterns } from "./noisePatternService";

const log = pino({ name: "refine-service" });

/**
 * Whisperの生テキストを整理する（LLM不使用・ローカル処理のみ）
 *
 * - Whisperの幻聴パターン除去（ハードコード + ユーザー登録）
 * - 重複フレーズ除去
 * - 連続セグメントの自然な結合
 */

// Whisperがよく出す幻聴・ノイズパターン（ビルトイン）
const BUILTIN_NOISE_PATTERNS = [
  /^\[.*?\]$/,                    // [音楽], [拍手] 等
  /^ご視聴ありがとうございました[。！]?$/,
  /^ありがとうございました[。！]?$/,
  /^チャンネル登録.*$/,
  /^字幕.*$/,
  /^\.+$/,                        // "..." のみ
  /^，+$/,                        // "，，，" のみ
  /^、+$/,
];

// ユーザー登録パターンのキャッシュ
let userPatternCache: { patterns: RegExp[]; exactMatches: Set<string> } | null = null;

/**
 * ユーザー登録パターンのキャッシュをリロード
 */
export async function reloadUserNoisePatterns(): Promise<void> {
  const rows = await listNoisePatterns();
  const patterns: RegExp[] = [];
  const exactMatches = new Set<string>();

  for (const row of rows) {
    if (row.isRegex) {
      try {
        patterns.push(new RegExp(row.pattern));
      } catch {
        log.warn({ pattern: row.pattern }, "Invalid regex noise pattern, skipping");
      }
    } else {
      exactMatches.add(row.pattern);
    }
  }

  userPatternCache = { patterns, exactMatches };
  log.info({ regex: patterns.length, exact: exactMatches.size }, "User noise patterns loaded");
}

function isNoise(text: string): boolean {
  const trimmed = text.trim();
  // ビルトインパターン
  if (BUILTIN_NOISE_PATTERNS.some((p) => p.test(trimmed))) return true;
  // ユーザー登録パターン
  if (userPatternCache) {
    if (userPatternCache.exactMatches.has(trimmed)) return true;
    if (userPatternCache.patterns.some((p) => p.test(trimmed))) return true;
  }
  return false;
}

/**
 * 2つのテキストの類似度を計算（0〜1、共通文字の割合）
 */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length > b.length ? a : b;
  if (longer.length === 0) return 0;
  // 短い方が長い方に含まれていれば高類似度
  if (longer.includes(shorter)) return shorter.length / longer.length;
  // 先頭一致の長さで判定
  let common = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (shorter[i] === longer[i]) common++;
    else break;
  }
  return common / longer.length;
}

/**
 * 連続する重複テキストを除去
 * Whisperは同じフレーズを繰り返し出力することがある
 */
function dedup(texts: string[]): string[] {
  const result: string[] = [];
  for (const t of texts) {
    // 短すぎるセグメントはスキップ（ノイズの可能性が高い）
    if (t.length <= 3) continue;

    const last = result[result.length - 1];
    if (!last) {
      result.push(t);
      continue;
    }

    // 完全一致
    if (last === t) continue;

    // 類似度が高い場合は重複とみなす（長い方を残す）
    if (similarity(last, t) > 0.7) {
      if (t.length > last.length) {
        result[result.length - 1] = t;
      }
      continue;
    }

    // 部分重複: 前のテキストの末尾と今のテキストの先頭が重なるケース
    const overlapWindow = Math.min(30, last.length);
    const tail = last.slice(-overlapWindow);
    if (tail.length >= 5 && t.startsWith(tail)) {
      result[result.length - 1] = last + t.slice(tail.length);
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
