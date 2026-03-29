/**
 * Errors Utilities のテスト
 */

import { describe, it, expect } from "vitest";
import {
  ErrorCodes,
  AppError,
  ValidationError,
  NotFoundError,
  InternalError,
  toAppError,
  isAppError,
} from "./index";

describe("ErrorCodes", () => {
  it("UNKNOWN コードが存在する", () => {
    expect(ErrorCodes.UNKNOWN).toBe("UNKNOWN");
  });

  it("VALIDATION_ で始まるコードが存在する", () => {
    expect(ErrorCodes.VALIDATION_REQUIRED).toBe("VALIDATION_REQUIRED");
    expect(ErrorCodes.VALIDATION_TOO_LONG).toBe("VALIDATION_TOO_LONG");
  });

  it("NOT_FOUND で終わるコードが存在する", () => {
    expect(ErrorCodes.NOTE_NOT_FOUND).toBe("NOTE_NOT_FOUND");
    expect(ErrorCodes.HISTORY_NOT_FOUND).toBe("HISTORY_NOT_FOUND");
  });
});

describe("AppError", () => {
  it("基本的なエラーを作成できる", () => {
    const error = new AppError(ErrorCodes.UNKNOWN, "Something went wrong");

    expect(error.code).toBe("UNKNOWN");
    expect(error.message).toBe("Something went wrong");
    expect(error.name).toBe("AppError");
    expect(error.statusCode).toBe(500);
  });

  it("フィールド情報を含められる", () => {
    const error = new AppError(ErrorCodes.VALIDATION_REQUIRED, "Required", {
      field: "title",
    });

    expect(error.field).toBe("title");
  });

  it("詳細情報を含められる", () => {
    const error = new AppError(ErrorCodes.INTERNAL, "Failed", {
      details: { retryCount: 3, lastAttempt: "2024-01-01" },
    });

    expect(error.details).toEqual({ retryCount: 3, lastAttempt: "2024-01-01" });
  });

  it("カスタムステータスコードを設定できる", () => {
    const error = new AppError(ErrorCodes.UNKNOWN, "Conflict", {
      statusCode: 409,
    });

    expect(error.statusCode).toBe(409);
  });

  it("causeを設定できる", () => {
    const cause = new Error("Original error");
    const error = new AppError(ErrorCodes.INTERNAL, "Wrapped", { cause });

    expect(error.cause).toBe(cause);
  });

  describe("toJSON", () => {
    it("基本的なJSON形式を返す", () => {
      const error = new AppError(ErrorCodes.UNKNOWN, "Error message");
      const json = error.toJSON();

      expect(json).toEqual({
        error: {
          code: "UNKNOWN",
          message: "Error message",
        },
      });
    });

    it("フィールドがあれば含める", () => {
      const error = new AppError(ErrorCodes.VALIDATION_REQUIRED, "Required", {
        field: "email",
      });
      const json = error.toJSON();

      expect(json.error.field).toBe("email");
    });

    it("詳細があれば含める", () => {
      const error = new AppError(ErrorCodes.INTERNAL, "Failed", {
        details: { reason: "timeout" },
      });
      const json = error.toJSON();

      expect(json.error.details).toEqual({ reason: "timeout" });
    });
  });

  describe("ステータスコードの自動マッピング", () => {
    it("VALIDATION_ で始まるコードは 400", () => {
      const error = new AppError(ErrorCodes.VALIDATION_TOO_LONG, "Too long");
      expect(error.statusCode).toBe(400);
    });

    it("_NOT_FOUND で終わるコードは 404", () => {
      const error = new AppError(ErrorCodes.NOTE_NOT_FOUND, "Not found");
      expect(error.statusCode).toBe(404);
    });

    it("BATCH_LIMIT_EXCEEDED は 400", () => {
      const error = new AppError(ErrorCodes.BATCH_LIMIT_EXCEEDED, "Too many");
      expect(error.statusCode).toBe(400);
    });

    it("INTERNAL は 500", () => {
      const error = new AppError(ErrorCodes.INTERNAL, "Server error");
      expect(error.statusCode).toBe(500);
    });

    it("その他のコードは 500", () => {
      const error = new AppError(ErrorCodes.GPT_CONTEXT_FAILED, "Failed");
      expect(error.statusCode).toBe(500);
    });
  });
});

describe("ValidationError", () => {
  it("バリデーションエラーを作成できる", () => {
    const error = new ValidationError("Title is required", "title");

    expect(error.code).toBe("VALIDATION_REQUIRED");
    expect(error.message).toBe("Title is required");
    expect(error.field).toBe("title");
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe("ValidationError");
  });

  it("カスタムエラーコードを指定できる", () => {
    const error = new ValidationError(
      "Too long",
      "content",
      ErrorCodes.VALIDATION_TOO_LONG
    );

    expect(error.code).toBe("VALIDATION_TOO_LONG");
  });

  it("AppError を継承している", () => {
    const error = new ValidationError("Invalid", "field");
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe("NotFoundError", () => {
  it("リソース名のみで作成できる", () => {
    const error = new NotFoundError("Note");

    expect(error.message).toBe("Note not found");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("NotFoundError");
  });

  it("IDを含めて作成できる", () => {
    const error = new NotFoundError("Note", "abc-123");

    expect(error.message).toBe("Note not found: abc-123");
    expect(error.details).toEqual({ id: "abc-123" });
  });

  it("カスタムエラーコードを指定できる", () => {
    const error = new NotFoundError(
      "Cluster",
      "cluster-1",
      ErrorCodes.CLUSTER_NOT_FOUND
    );

    expect(error.code).toBe("CLUSTER_NOT_FOUND");
  });

  it("AppError を継承している", () => {
    const error = new NotFoundError("Resource");
    expect(error instanceof AppError).toBe(true);
  });
});

describe("InternalError", () => {
  it("内部エラーを作成できる", () => {
    const error = new InternalError("Database connection failed");

    expect(error.code).toBe("INTERNAL");
    expect(error.message).toBe("Database connection failed");
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe("InternalError");
  });

  it("cause を含めて作成できる", () => {
    const cause = new Error("ECONNREFUSED");
    const error = new InternalError("Failed", cause);

    expect(error.cause).toBe(cause);
  });

  it("AppError を継承している", () => {
    const error = new InternalError("Error");
    expect(error instanceof AppError).toBe(true);
  });
});

describe("toAppError", () => {
  it("AppError はそのまま返す", () => {
    const original = new AppError(ErrorCodes.UNKNOWN, "Test");
    const result = toAppError(original);

    expect(result).toBe(original);
  });

  it("通常の Error を AppError に変換する", () => {
    const error = new Error("Some error");
    const result = toAppError(error);

    expect(result instanceof AppError).toBe(true);
    expect(result.code).toBe("UNKNOWN");
    expect(result.message).toBe("Some error");
    expect(result.cause).toBe(error);
  });

  it("文字列を AppError に変換する", () => {
    const result = toAppError("String error");

    expect(result instanceof AppError).toBe(true);
    expect(result.message).toBe("String error");
  });

  it("その他の値を文字列化して AppError に変換する", () => {
    const result = toAppError(123);

    expect(result instanceof AppError).toBe(true);
    expect(result.message).toBe("123");
  });

  it("ValidationError はそのまま返す", () => {
    const original = new ValidationError("Invalid", "field");
    const result = toAppError(original);

    expect(result).toBe(original);
    expect(result instanceof ValidationError).toBe(true);
  });
});

describe("isAppError", () => {
  it("AppError に対して true を返す", () => {
    const error = new AppError(ErrorCodes.UNKNOWN, "Test");
    expect(isAppError(error)).toBe(true);
  });

  it("ValidationError に対して true を返す", () => {
    const error = new ValidationError("Invalid", "field");
    expect(isAppError(error)).toBe(true);
  });

  it("NotFoundError に対して true を返す", () => {
    const error = new NotFoundError("Resource");
    expect(isAppError(error)).toBe(true);
  });

  it("InternalError に対して true を返す", () => {
    const error = new InternalError("Failed");
    expect(isAppError(error)).toBe(true);
  });

  it("通常の Error に対して false を返す", () => {
    const error = new Error("Normal error");
    expect(isAppError(error)).toBe(false);
  });

  it("null に対して false を返す", () => {
    expect(isAppError(null)).toBe(false);
  });

  it("undefined に対して false を返す", () => {
    expect(isAppError(undefined)).toBe(false);
  });

  it("文字列に対して false を返す", () => {
    expect(isAppError("error string")).toBe(false);
  });
});
