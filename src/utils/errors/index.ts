/**
 * 標準化されたエラーコード・エラークラス
 *
 * すべてのエラーは AppError を継承し、
 * { code, message, field?, details? } 形式で構造化される
 */

// -------------------------------------
// エラーコード定義
// -------------------------------------

export const ErrorCodes = {
  // 汎用エラー
  UNKNOWN: "UNKNOWN",
  INTERNAL: "INTERNAL",

  // バリデーションエラー
  VALIDATION_REQUIRED: "VALIDATION_REQUIRED",
  VALIDATION_REQUIRED_STRING: "VALIDATION_REQUIRED_STRING",
  VALIDATION_TOO_SHORT: "VALIDATION_TOO_SHORT",
  VALIDATION_TOO_LONG: "VALIDATION_TOO_LONG",
  VALIDATION_INVALID_UUID: "VALIDATION_INVALID_UUID",
  VALIDATION_INVALID_DATE: "VALIDATION_INVALID_DATE",
  VALIDATION_INVALID_NUMBER: "VALIDATION_INVALID_NUMBER",
  VALIDATION_INVALID_ENUM: "VALIDATION_INVALID_ENUM",
  VALIDATION_NOT_ARRAY: "VALIDATION_NOT_ARRAY",
  VALIDATION_EMPTY_ARRAY: "VALIDATION_EMPTY_ARRAY",
  VALIDATION_TOO_MANY_ITEMS: "VALIDATION_TOO_MANY_ITEMS",
  VALIDATION_INVALID_ITEM: "VALIDATION_INVALID_ITEM",
  VALIDATION_OUT_OF_RANGE: "VALIDATION_OUT_OF_RANGE",

  // ノート関連エラー
  NOTE_NOT_FOUND: "NOTE_NOT_FOUND",
  NOTE_CREATE_FAILED: "NOTE_CREATE_FAILED",
  NOTE_UPDATE_FAILED: "NOTE_UPDATE_FAILED",
  NOTE_DELETE_FAILED: "NOTE_DELETE_FAILED",

  // 履歴関連エラー
  HISTORY_NOT_FOUND: "HISTORY_NOT_FOUND",
  HISTORY_MISMATCH: "HISTORY_MISMATCH",

  // クラスタ関連エラー
  CLUSTER_NOT_FOUND: "CLUSTER_NOT_FOUND",
  CLUSTER_BUILD_FAILED: "CLUSTER_BUILD_FAILED",

  // Embedding関連エラー
  EMBEDDING_NOT_FOUND: "EMBEDDING_NOT_FOUND",
  EMBEDDING_GENERATE_FAILED: "EMBEDDING_GENERATE_FAILED",

  // 検索関連エラー
  SEARCH_FAILED: "SEARCH_FAILED",
  SEARCH_QUERY_REQUIRED: "SEARCH_QUERY_REQUIRED",

  // バッチ操作エラー
  BATCH_LIMIT_EXCEEDED: "BATCH_LIMIT_EXCEEDED",

  // GPT関連エラー
  GPT_CONTEXT_FAILED: "GPT_CONTEXT_FAILED",

  // ワークフロー関連エラー
  WORKFLOW_FAILED: "WORKFLOW_FAILED",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// -------------------------------------
// AppError クラス
// -------------------------------------

export interface AppErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly field?: string;
  readonly details?: AppErrorDetails;
  readonly statusCode: number;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      field?: string;
      details?: AppErrorDetails;
      statusCode?: number;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.field = options?.field;
    this.details = options?.details;
    this.statusCode = options?.statusCode ?? mapCodeToStatus(code);
  }

  /**
   * JSON形式に変換（API応答用）
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.field && { field: this.field }),
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// -------------------------------------
// 特化型エラークラス
// -------------------------------------

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    field: string,
    code: ErrorCode = ErrorCodes.VALIDATION_REQUIRED
  ) {
    super(code, message, { field, statusCode: 400 });
    this.name = "ValidationError";
  }
}

/**
 * NotFoundエラー
 */
export class NotFoundError extends AppError {
  constructor(
    resource: string,
    id?: string,
    code: ErrorCode = ErrorCodes.NOTE_NOT_FOUND
  ) {
    const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
    super(code, message, {
      statusCode: 404,
      details: id ? { id } : undefined,
    });
    this.name = "NotFoundError";
  }
}

/**
 * 内部エラー
 */
export class InternalError extends AppError {
  constructor(message: string, cause?: Error) {
    super(ErrorCodes.INTERNAL, message, { statusCode: 500, cause });
    this.name = "InternalError";
  }
}

// -------------------------------------
// ヘルパー関数
// -------------------------------------

/**
 * エラーコードからHTTPステータスコードをマッピング
 */
function mapCodeToStatus(code: ErrorCode): number {
  if (code.startsWith("VALIDATION_")) return 400;
  if (code.endsWith("_NOT_FOUND")) return 404;
  if (code === ErrorCodes.BATCH_LIMIT_EXCEEDED) return 400;
  if (code === ErrorCodes.INTERNAL) return 500;
  return 500;
}

/**
 * 任意のエラーをAppErrorに変換
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) {
    return err;
  }

  if (err instanceof Error) {
    return new AppError(ErrorCodes.UNKNOWN, err.message, { cause: err });
  }

  return new AppError(ErrorCodes.UNKNOWN, String(err));
}

/**
 * エラーがAppErrorかどうかをチェック
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
