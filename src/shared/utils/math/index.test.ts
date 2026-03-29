/**
 * Math Utilities のテスト
 */

import { describe, it, expect } from "vitest";
import {
  round4,
  bufferToFloat32Array,
  float32ArrayToBuffer,
  cosineSimilarity,
  meanVector,
  normalizeVector,
} from "./index";

describe("round4", () => {
  it("小数点4桁で丸める", () => {
    expect(round4(0.123456789)).toBe(0.1235);
    expect(round4(0.12344)).toBe(0.1234);
    expect(round4(0.12345)).toBe(0.1235);
  });

  it("整数はそのまま返す", () => {
    expect(round4(5)).toBe(5);
    expect(round4(100)).toBe(100);
  });

  it("負の数も正しく丸める", () => {
    expect(round4(-0.123456)).toBe(-0.1235);
  });

  it("0は0を返す", () => {
    expect(round4(0)).toBe(0);
  });
});

describe("bufferToFloat32Array", () => {
  it("Buffer を number[] に変換する", () => {
    const original = [1.0, 2.0, 3.0];
    const buffer = float32ArrayToBuffer(original);
    const result = bufferToFloat32Array(buffer);

    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(1.0);
    expect(result[1]).toBeCloseTo(2.0);
    expect(result[2]).toBeCloseTo(3.0);
  });

  it("ArrayBuffer を変換する", () => {
    const float32 = new Float32Array([1.5, 2.5]);
    const arrayBuffer = float32.buffer;
    const result = bufferToFloat32Array(arrayBuffer);

    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(1.5);
    expect(result[1]).toBeCloseTo(2.5);
  });

  it("Uint8Array を変換する", () => {
    const float32 = new Float32Array([3.0, 4.0]);
    const uint8 = new Uint8Array(float32.buffer);
    const result = bufferToFloat32Array(uint8);

    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(3.0);
    expect(result[1]).toBeCloseTo(4.0);
  });

  it("未知の型は空配列を返す", () => {
    const result = bufferToFloat32Array("invalid" as any);
    expect(result).toEqual([]);
  });
});

describe("float32ArrayToBuffer", () => {
  it("number[] を Buffer に変換する", () => {
    const arr = [1.0, 2.0, 3.0];
    const buffer = float32ArrayToBuffer(arr);

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBe(12); // 3 * 4 bytes
  });

  it("空配列は空の Buffer を返す", () => {
    const buffer = float32ArrayToBuffer([]);
    expect(buffer.length).toBe(0);
  });

  it("往復変換で元の値に戻る", () => {
    const original = [1.5, -2.5, 0, 100.123];
    const buffer = float32ArrayToBuffer(original);
    const result = bufferToFloat32Array(buffer);

    expect(result.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(result[i]).toBeCloseTo(original[i], 3);
    }
  });
});

describe("cosineSimilarity", () => {
  it("同じベクトルの類似度は1", () => {
    const vec = [0.6, 0.8]; // 正規化済み (0.6^2 + 0.8^2 = 1)
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1);
  });

  it("直交するベクトルの類似度は0", () => {
    const a = [1, 0];
    const b = [0, 1];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("逆向きのベクトルの類似度は-1", () => {
    const a = [1, 0];
    const b = [-1, 0];
    expect(cosineSimilarity(a, b)).toBe(-1);
  });

  it("長さが異なる場合は0を返す", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("空配列は0を返す", () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it("内積を正しく計算する", () => {
    const a = [1, 2, 3];
    const b = [4, 5, 6];
    // 1*4 + 2*5 + 3*6 = 4 + 10 + 18 = 32
    expect(cosineSimilarity(a, b)).toBe(32);
  });
});

describe("meanVector", () => {
  it("ベクトルの平均を計算する", () => {
    const vectors = [
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ];
    const result = meanVector(vectors);

    expect(result).toEqual([4, 5, 6]);
  });

  it("単一ベクトルはそのまま返す", () => {
    const vectors = [[1, 2, 3]];
    const result = meanVector(vectors);

    expect(result).toEqual([1, 2, 3]);
  });

  it("空配列は空配列を返す", () => {
    const result = meanVector([]);
    expect(result).toEqual([]);
  });

  it("小数点の平均も計算できる", () => {
    const vectors = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];
    const result = meanVector(vectors);

    expect(result[0]).toBeCloseTo(0.2);
    expect(result[1]).toBeCloseTo(0.3);
  });
});

describe("normalizeVector", () => {
  it("ベクトルを正規化する", () => {
    const vec = [3, 4]; // ノルム = 5
    const result = normalizeVector(vec);

    expect(result[0]).toBeCloseTo(0.6);
    expect(result[1]).toBeCloseTo(0.8);
  });

  it("正規化後のノルムは1", () => {
    const vec = [1, 2, 3, 4, 5];
    const result = normalizeVector(vec);

    const norm = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));
    expect(norm).toBeCloseTo(1);
  });

  it("ゼロベクトルはそのまま返す", () => {
    const vec = [0, 0, 0];
    const result = normalizeVector(vec);

    expect(result).toEqual([0, 0, 0]);
  });

  it("単位ベクトルはそのまま", () => {
    const vec = [1, 0, 0];
    const result = normalizeVector(vec);

    expect(result).toEqual([1, 0, 0]);
  });

  it("負の値も正しく正規化する", () => {
    const vec = [-3, 4]; // ノルム = 5
    const result = normalizeVector(vec);

    expect(result[0]).toBeCloseTo(-0.6);
    expect(result[1]).toBeCloseTo(0.8);
  });
});
