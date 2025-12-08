import { describe, it, expect } from "vitest";
import {
  ValidationError,
  requireField,
  requireString,
  validateStringLength,
  validateTitle,
  validateContent,
  validateQuery,
  validateLimit,
  validateLimitAllowAll,
  validateOffset,
  validateUUID,
  validateId,
  validateK,
  validateDate,
  validateOptionalDate,
  validateNumberRange,
  validateArray,
  validateOptionalArray,
  validateEnum,
  validateOptionalEnum,
  LIMITS,
} from "./index";

describe("validation utilities", () => {
  describe("requireField", () => {
    it("値が存在すればそのまま返す", () => {
      expect(requireField("test", "field")).toBe("test");
      expect(requireField(0, "field")).toBe(0);
      expect(requireField(false, "field")).toBe(false);
    });

    it("undefined または null は ValidationError をスロー", () => {
      expect(() => requireField(undefined, "field")).toThrow(ValidationError);
      expect(() => requireField(null, "field")).toThrow(ValidationError);
    });
  });

  describe("requireString", () => {
    it("文字列ならそのまま返す", () => {
      expect(requireString("test", "field")).toBe("test");
    });

    it("空文字は ValidationError をスロー", () => {
      expect(() => requireString("", "field")).toThrow(ValidationError);
      expect(() => requireString("   ", "field")).toThrow(ValidationError);
    });

    it("非文字列は ValidationError をスロー", () => {
      expect(() => requireString(123, "field")).toThrow(ValidationError);
      expect(() => requireString(null, "field")).toThrow(ValidationError);
    });
  });

  describe("validateStringLength", () => {
    it("範囲内ならそのまま返す", () => {
      expect(validateStringLength("abc", "field", 10)).toBe("abc");
      expect(validateStringLength("abc", "field", 10, 1)).toBe("abc");
    });

    it("長すぎる場合は ValidationError をスロー", () => {
      expect(() => validateStringLength("abcdef", "field", 3)).toThrow(ValidationError);
    });

    it("短すぎる場合は ValidationError をスロー", () => {
      expect(() => validateStringLength("ab", "field", 10, 3)).toThrow(ValidationError);
    });
  });

  describe("validateTitle", () => {
    it("有効なタイトルを返す", () => {
      expect(validateTitle("テストタイトル")).toBe("テストタイトル");
    });

    it("空文字は ValidationError をスロー", () => {
      expect(() => validateTitle("")).toThrow(ValidationError);
    });

    it("500文字を超えると ValidationError をスロー", () => {
      expect(() => validateTitle("a".repeat(501))).toThrow(ValidationError);
    });
  });

  describe("validateContent", () => {
    it("有効なコンテンツを返す", () => {
      expect(validateContent("テスト内容")).toBe("テスト内容");
    });

    it("100,000文字を超えると ValidationError をスロー", () => {
      expect(() => validateContent("a".repeat(100001))).toThrow(ValidationError);
    });
  });

  describe("validateQuery", () => {
    it("有効なクエリを返す", () => {
      expect(validateQuery("検索")).toBe("検索");
    });

    it("500文字を超えると ValidationError をスロー", () => {
      expect(() => validateQuery("a".repeat(501))).toThrow(ValidationError);
    });
  });

  describe("validateLimit", () => {
    it("undefined はデフォルト値を返す", () => {
      expect(validateLimit(undefined)).toBe(LIMITS.LIMIT_DEFAULT);
      expect(validateLimit(undefined, 10)).toBe(10);
    });

    it("有効な数値はそのまま返す", () => {
      expect(validateLimit(50)).toBe(50);
      expect(validateLimit(100)).toBe(100);
    });

    it("負数は最小値に丸められる", () => {
      expect(validateLimit(-10)).toBe(LIMITS.LIMIT_MIN);
    });

    it("上限超過は最大値に丸められる", () => {
      expect(validateLimit(2000)).toBe(LIMITS.LIMIT_MAX);
    });

    it("文字列も数値に変換される", () => {
      expect(validateLimit("50")).toBe(50);
    });

    it("無効な値はデフォルトを返す", () => {
      expect(validateLimit("abc")).toBe(LIMITS.LIMIT_DEFAULT);
    });
  });

  describe("validateLimitAllowAll", () => {
    it("0 は全件取得を意味する", () => {
      expect(validateLimitAllowAll(0)).toBe(0);
    });

    it("正の値は通常通り処理", () => {
      expect(validateLimitAllowAll(50)).toBe(50);
    });

    it("負数はデフォルト値を返す", () => {
      expect(validateLimitAllowAll(-10)).toBe(LIMITS.LIMIT_DEFAULT);
    });
  });

  describe("validateOffset", () => {
    it("undefined はデフォルト(0)を返す", () => {
      expect(validateOffset(undefined)).toBe(0);
    });

    it("有効な数値はそのまま返す", () => {
      expect(validateOffset(10)).toBe(10);
    });

    it("負数はデフォルト(0)を返す", () => {
      expect(validateOffset(-5)).toBe(0);
    });
  });

  describe("validateUUID / validateId", () => {
    const validUUID = "550e8400-e29b-41d4-a716-446655440000";

    it("有効な UUID を返す", () => {
      expect(validateUUID(validUUID)).toBe(validUUID);
      expect(validateId(validUUID)).toBe(validUUID);
    });

    it("無効な UUID は ValidationError をスロー", () => {
      expect(() => validateUUID("not-a-uuid")).toThrow(ValidationError);
      expect(() => validateUUID("550e8400-e29b-41d4-a716")).toThrow(ValidationError);
    });

    it("空文字は ValidationError をスロー", () => {
      expect(() => validateId("")).toThrow(ValidationError);
    });
  });

  describe("validateK", () => {
    it("undefined はデフォルト(8)を返す", () => {
      expect(validateK(undefined)).toBe(LIMITS.K_DEFAULT);
    });

    it("範囲内の値はそのまま返す", () => {
      expect(validateK(5)).toBe(5);
      expect(validateK(10)).toBe(10);
    });

    it("最小値未満は最小値に丸められる", () => {
      expect(validateK(1)).toBe(LIMITS.K_MIN);
    });

    it("最大値超過は最大値に丸められる", () => {
      expect(validateK(100)).toBe(LIMITS.K_MAX);
    });
  });

  describe("validateDate / validateOptionalDate", () => {
    it("有効な日付形式を返す", () => {
      expect(validateDate("2025-12-09")).toBe("2025-12-09");
    });

    it("無効な形式は ValidationError をスロー", () => {
      expect(() => validateDate("12/09/2025")).toThrow(ValidationError);
      expect(() => validateDate("2025-13-01")).toThrow(ValidationError);
    });

    it("validateOptionalDate は undefined を許容", () => {
      expect(validateOptionalDate(undefined)).toBeUndefined();
      expect(validateOptionalDate("")).toBeUndefined();
      expect(validateOptionalDate("2025-12-09")).toBe("2025-12-09");
    });
  });

  describe("validateNumberRange", () => {
    it("範囲内の値を返す", () => {
      expect(validateNumberRange(5, "field", 0, 10)).toBe(5);
    });

    it("範囲外は ValidationError をスロー", () => {
      expect(() => validateNumberRange(-1, "field", 0, 10)).toThrow(ValidationError);
      expect(() => validateNumberRange(11, "field", 0, 10)).toThrow(ValidationError);
    });

    it("デフォルト値がある場合は undefined で使用", () => {
      expect(validateNumberRange(undefined, "field", 0, 10, 5)).toBe(5);
    });

    it("デフォルト値がない場合は undefined で ValidationError", () => {
      expect(() => validateNumberRange(undefined, "field", 0, 10)).toThrow(ValidationError);
    });
  });

  describe("validateArray / validateOptionalArray", () => {
    it("配列を返す", () => {
      expect(validateArray([1, 2, 3], "field")).toEqual([1, 2, 3]);
    });

    it("非配列は ValidationError をスロー", () => {
      expect(() => validateArray("not-array", "field")).toThrow(ValidationError);
    });

    it("アイテムバリデーターを適用", () => {
      const result = validateArray([1, 2, 3], "field", (item) => (item as number) * 2);
      expect(result).toEqual([2, 4, 6]);
    });

    it("validateOptionalArray は undefined を許容", () => {
      expect(validateOptionalArray(undefined, "field")).toBeUndefined();
      expect(validateOptionalArray([1, 2], "field")).toEqual([1, 2]);
    });
  });

  describe("validateEnum / validateOptionalEnum", () => {
    const allowedValues = ["a", "b", "c"] as const;

    it("許可された値を返す", () => {
      expect(validateEnum("a", "field", allowedValues)).toBe("a");
      expect(validateEnum("b", "field", allowedValues)).toBe("b");
    });

    it("許可されていない値は ValidationError をスロー", () => {
      expect(() => validateEnum("d", "field", allowedValues)).toThrow(ValidationError);
    });

    it("validateOptionalEnum は undefined を許容", () => {
      expect(validateOptionalEnum(undefined, "field", allowedValues)).toBeUndefined();
      expect(validateOptionalEnum("a", "field", allowedValues)).toBe("a");
    });
  });

  describe("ValidationError", () => {
    it("フィールド名とコードを含む", () => {
      const error = new ValidationError("message", "myField", "MY_CODE");
      expect(error.message).toBe("message");
      expect(error.field).toBe("myField");
      expect(error.code).toBe("MY_CODE");
      expect(error.name).toBe("ValidationError");
    });
  });
});
