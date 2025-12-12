/**
 * Math Utilities
 *
 * ベクトル演算・数値変換のユーティリティ関数
 */

/**
 * 小数点4桁で丸める
 */
export function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

/**
 * Buffer を number[] に変換
 */
export function bufferToFloat32Array(buffer: Buffer | ArrayBuffer | Uint8Array): number[] {
  let uint8: Uint8Array;

  if (buffer instanceof ArrayBuffer) {
    uint8 = new Uint8Array(buffer);
  } else if (buffer instanceof Uint8Array) {
    uint8 = buffer;
  } else if (Buffer.isBuffer(buffer)) {
    uint8 = new Uint8Array(buffer);
  } else {
    return [];
  }

  const arrayBuffer = uint8.buffer.slice(uint8.byteOffset, uint8.byteOffset + uint8.byteLength);
  const float32 = new Float32Array(arrayBuffer);
  return Array.from(float32);
}

/**
 * number[] を Buffer に変換
 */
export function float32ArrayToBuffer(arr: number[]): Buffer {
  const float32 = new Float32Array(arr);
  return Buffer.from(float32.buffer);
}

/**
 * コサイン類似度を計算（正規化済みベクトル前提）
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * ベクトルの平均を計算
 */
export function meanVector(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      result[i] += vec[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length;
  }

  return result;
}

/**
 * ベクトルを L2 正規化
 */
export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}
