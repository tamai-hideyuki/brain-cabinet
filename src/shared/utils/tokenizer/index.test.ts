/**
 * トークナイザーのテスト
 */

import { describe, it, expect } from "vitest";
import { tokenize, tokenizeAndFilter } from "./index";

describe("tokenize", () => {
  it("日本語テキストを形態素に分割する", () => {
    const result = tokenize("今日はプログラミングを勉強した");

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("今日");
    expect(result).toContain("プログラミング");
    expect(result).toContain("勉強");
  });

  it("空文字列は空配列を返す", () => {
    const result = tokenize("");

    expect(result).toEqual([]);
  });

  it("英語テキストも処理できる", () => {
    const result = tokenize("Hello World");

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("日英混在テキストを処理できる", () => {
    const result = tokenize("TypeScriptは型安全なプログラミング言語です");

    expect(result).toBeInstanceOf(Array);
    expect(result).toContain("TypeScript");
    expect(result).toContain("プログラミング");
    // TinySegmenterは「型安全」を「型安」「全」に分割することがある
    expect(result.join("")).toContain("型");
  });

  it("数字を含むテキストを処理できる", () => {
    const result = tokenize("2024年1月1日に開始");

    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("記号を含むテキストを処理できる", () => {
    const result = tokenize("これは「テスト」です！");

    expect(result).toBeInstanceOf(Array);
    expect(result).toContain("テスト");
  });
});

describe("tokenizeAndFilter", () => {
  it("デフォルトで2文字未満のトークンを除外する", () => {
    const result = tokenizeAndFilter("今日はプログラミングを勉強した");

    // 「は」「を」などの1文字助詞は除外される
    expect(result).not.toContain("は");
    expect(result).not.toContain("を");
    // 2文字以上は残る
    expect(result).toContain("今日");
    expect(result).toContain("プログラミング");
    expect(result).toContain("勉強");
  });

  it("minLengthを指定できる", () => {
    const result = tokenizeAndFilter("今日はプログラミングを勉強した", 3);

    // 2文字の「今日」「勉強」も除外される
    expect(result).not.toContain("今日");
    expect(result).not.toContain("勉強");
    // 3文字以上は残る
    expect(result).toContain("プログラミング");
  });

  it("minLength=1で全てのトークンを含める", () => {
    const result = tokenizeAndFilter("今日はプログラミングを勉強した", 1);

    // 1文字の「は」「を」も含まれる
    expect(result).toContain("は");
    expect(result).toContain("を");
  });

  it("空文字列は空配列を返す", () => {
    const result = tokenizeAndFilter("");

    expect(result).toEqual([]);
  });

  it("全てのトークンがminLength未満の場合は空配列を返す", () => {
    const result = tokenizeAndFilter("あ い う", 5);

    expect(result).toEqual([]);
  });
});
