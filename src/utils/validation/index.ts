/**
 * 入力バリデーションユーティリティ
 *
 * 各dispatcherで使用する共通のバリデーション関数
 */

// 制限値定数
export const LIMITS = {
  TITLE_MAX_LENGTH: 500,
  CONTENT_MAX_LENGTH: 100_000,
  QUERY_MAX_LENGTH: 500,
  LIMIT_MIN: 1,
  LIMIT_MAX: 1000,
  LIMIT_DEFAULT: 50,
  OFFSET_MIN: 0,
  K_MIN: 2,
  K_MAX: 50,
  K_DEFAULT: 8,
} as const;

// バリデーションエラー
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * 必須フィールドのチェック
 */
export const requireField = <T>(value: T | undefined | null, field: string): T => {
  if (value === undefined || value === null) {
    throw new ValidationError(`${field} is required`, field, "REQUIRED");
  }
  return value;
};

/**
 * 文字列の必須チェック（空文字も不可）
 */
export const requireString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} is required and must be a non-empty string`, field, "REQUIRED_STRING");
  }
  return value;
};

/**
 * 文字列の長さチェック
 */
export const validateStringLength = (
  value: string,
  field: string,
  maxLength: number,
  minLength = 0
): string => {
  if (value.length < minLength) {
    throw new ValidationError(
      `${field} must be at least ${minLength} characters`,
      field,
      "TOO_SHORT"
    );
  }
  if (value.length > maxLength) {
    throw new ValidationError(
      `${field} must be at most ${maxLength} characters`,
      field,
      "TOO_LONG"
    );
  }
  return value;
};

/**
 * タイトルのバリデーション
 */
export const validateTitle = (value: unknown, field = "title"): string => {
  const title = requireString(value, field);
  return validateStringLength(title, field, LIMITS.TITLE_MAX_LENGTH, 1);
};

/**
 * コンテンツのバリデーション
 */
export const validateContent = (value: unknown, field = "content"): string => {
  const content = requireString(value, field);
  return validateStringLength(content, field, LIMITS.CONTENT_MAX_LENGTH, 1);
};

/**
 * 検索クエリのバリデーション
 */
export const validateQuery = (value: unknown, field = "query"): string => {
  const query = requireString(value, field);
  return validateStringLength(query, field, LIMITS.QUERY_MAX_LENGTH, 1);
};

/**
 * limitパラメータのバリデーション
 * - undefinedの場合はデフォルト値を返す
 * - 0以下や上限超過は範囲内に収める（エラーにしない）
 */
export const validateLimit = (value: unknown, defaultValue: number = LIMITS.LIMIT_DEFAULT): number => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const num = typeof value === "number" ? value : parseInt(String(value), 10);

  if (isNaN(num)) {
    return defaultValue;
  }

  // 範囲内に収める（エラーにしない）
  return Math.max(LIMITS.LIMIT_MIN, Math.min(LIMITS.LIMIT_MAX, num));
};

/**
 * limitパラメータのバリデーション（制限なし許可版）
 * - 0を指定すると全件取得を意味する
 */
export const validateLimitAllowAll = (value: unknown, defaultValue: number = LIMITS.LIMIT_DEFAULT): number => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const num = typeof value === "number" ? value : parseInt(String(value), 10);

  if (isNaN(num)) {
    return defaultValue;
  }

  // 0は全件取得を意味する
  if (num === 0) {
    return 0;
  }

  // 負数はデフォルトに
  if (num < 0) {
    return defaultValue;
  }

  // 上限は適用
  return Math.min(LIMITS.LIMIT_MAX, num);
};

/**
 * offsetパラメータのバリデーション
 */
export const validateOffset = (value: unknown, defaultValue = 0): number => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const num = typeof value === "number" ? value : parseInt(String(value), 10);

  if (isNaN(num) || num < LIMITS.OFFSET_MIN) {
    return defaultValue;
  }

  return num;
};

/**
 * UUID形式のバリデーション
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const validateUUID = (value: unknown, field = "id"): string => {
  const id = requireString(value, field);

  if (!UUID_REGEX.test(id)) {
    throw new ValidationError(`${field} must be a valid UUID`, field, "INVALID_UUID");
  }

  return id;
};

/**
 * ID（UUID形式）のバリデーション（必須）
 */
export const validateId = (value: unknown, field = "id"): string => {
  return validateUUID(value, field);
};

/**
 * クラスタ数(k)のバリデーション
 */
export const validateK = (value: unknown, defaultValue = LIMITS.K_DEFAULT): number => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  const num = typeof value === "number" ? value : parseInt(String(value), 10);

  if (isNaN(num)) {
    return defaultValue;
  }

  // 範囲内に収める
  return Math.max(LIMITS.K_MIN, Math.min(LIMITS.K_MAX, num));
};

/**
 * ISO8601日付形式のバリデーション
 */
const ISO8601_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const validateDate = (value: unknown, field = "date"): string => {
  const dateStr = requireString(value, field);

  if (!ISO8601_DATE_REGEX.test(dateStr)) {
    throw new ValidationError(
      `${field} must be in YYYY-MM-DD format`,
      field,
      "INVALID_DATE_FORMAT"
    );
  }

  // 有効な日付かチェック
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${field} is not a valid date`, field, "INVALID_DATE");
  }

  return dateStr;
};

/**
 * オプショナルな日付のバリデーション
 */
export const validateOptionalDate = (value: unknown, field = "date"): string | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return validateDate(value, field);
};

/**
 * 数値の範囲チェック
 */
export const validateNumberRange = (
  value: unknown,
  field: string,
  min: number,
  max: number,
  defaultValue?: number
): number => {
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new ValidationError(`${field} is required`, field, "REQUIRED");
  }

  const num = typeof value === "number" ? value : parseFloat(String(value));

  if (isNaN(num)) {
    throw new ValidationError(`${field} must be a valid number`, field, "INVALID_NUMBER");
  }

  if (num < min || num > max) {
    throw new ValidationError(
      `${field} must be between ${min} and ${max}`,
      field,
      "OUT_OF_RANGE"
    );
  }

  return num;
};

/**
 * 配列のバリデーション
 */
export const validateArray = <T>(
  value: unknown,
  field: string,
  itemValidator?: (item: unknown, index: number) => T
): T[] => {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${field} must be an array`, field, "NOT_ARRAY");
  }

  if (itemValidator) {
    return value.map((item, index) => itemValidator(item, index));
  }

  return value as T[];
};

/**
 * オプショナルな配列のバリデーション
 */
export const validateOptionalArray = <T>(
  value: unknown,
  field: string,
  itemValidator?: (item: unknown, index: number) => T
): T[] | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  return validateArray(value, field, itemValidator);
};

/**
 * enum値のバリデーション
 */
export const validateEnum = <T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[]
): T => {
  const str = requireString(value, field);

  if (!allowedValues.includes(str as T)) {
    throw new ValidationError(
      `${field} must be one of: ${allowedValues.join(", ")}`,
      field,
      "INVALID_ENUM"
    );
  }

  return str as T;
};

/**
 * オプショナルなenum値のバリデーション
 */
export const validateOptionalEnum = <T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[]
): T | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return validateEnum(value, field, allowedValues);
};

// カテゴリ定義（schema.tsと同期）
const CATEGORIES = [
  "技術",
  "心理",
  "健康",
  "仕事",
  "人間関係",
  "学習",
  "アイデア",
  "走り書き",
  "その他",
] as const;

/**
 * カテゴリのバリデーション
 */
export const validateCategory = (value: unknown, field = "category"): string => {
  return validateEnum(value, field, CATEGORIES);
};

/**
 * ID配列のバリデーション（バッチ操作用）
 */
export const validateIdArray = (
  value: unknown,
  field = "ids",
  maxLength = 100
): string[] => {
  const arr = validateArray<string>(value, field, (item, index) => {
    if (typeof item !== "string") {
      throw new ValidationError(
        `${field}[${index}] must be a string`,
        field,
        "INVALID_ITEM"
      );
    }
    return validateUUID(item, `${field}[${index}]`);
  });

  if (arr.length === 0) {
    throw new ValidationError(`${field} must not be empty`, field, "EMPTY_ARRAY");
  }

  if (arr.length > maxLength) {
    throw new ValidationError(
      `${field} must contain at most ${maxLength} items`,
      field,
      "TOO_MANY_ITEMS"
    );
  }

  return arr;
};
