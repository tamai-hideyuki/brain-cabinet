/**
 * シークレットBOX用バリデーション
 */

import { ValidationError, ErrorCodes } from "../errors";
import type { SecretBoxItemType } from "../../db/schema";

// シークレットBOX制限値
export const SECRET_BOX_LIMITS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  NAME_MAX_LENGTH: 255,
  ALLOWED_IMAGE_TYPES: ["image/jpeg", "image/png", "image/gif", "image/webp"] as const,
  ALLOWED_VIDEO_TYPES: ["video/mp4", "video/webm", "video/quicktime"] as const,
} as const;

/**
 * ファイルサイズのバリデーション
 */
export const validateFileSize = (size: number, field = "file"): void => {
  if (size > SECRET_BOX_LIMITS.MAX_FILE_SIZE) {
    throw new ValidationError(
      `${field} exceeds maximum size of 100MB`,
      field,
      ErrorCodes.SECRET_BOX_FILE_TOO_LARGE
    );
  }
};

/**
 * MIMEタイプのバリデーション
 * @returns 判定されたアイテムタイプ（"image" | "video"）
 */
export const validateMimeType = (mimeType: string, field = "file"): SecretBoxItemType => {
  if (SECRET_BOX_LIMITS.ALLOWED_IMAGE_TYPES.includes(mimeType as typeof SECRET_BOX_LIMITS.ALLOWED_IMAGE_TYPES[number])) {
    return "image";
  }
  if (SECRET_BOX_LIMITS.ALLOWED_VIDEO_TYPES.includes(mimeType as typeof SECRET_BOX_LIMITS.ALLOWED_VIDEO_TYPES[number])) {
    return "video";
  }
  throw new ValidationError(
    `${field} has unsupported type: ${mimeType}. Allowed: ${[...SECRET_BOX_LIMITS.ALLOWED_IMAGE_TYPES, ...SECRET_BOX_LIMITS.ALLOWED_VIDEO_TYPES].join(", ")}`,
    field,
    ErrorCodes.SECRET_BOX_INVALID_FILE_TYPE
  );
};

/**
 * ファイル名のバリデーション
 */
export const validateFileName = (name: string, field = "name"): string => {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationError(
      `${field} is required`,
      field,
      ErrorCodes.VALIDATION_REQUIRED_STRING
    );
  }
  if (trimmed.length > SECRET_BOX_LIMITS.NAME_MAX_LENGTH) {
    throw new ValidationError(
      `${field} must be at most ${SECRET_BOX_LIMITS.NAME_MAX_LENGTH} characters`,
      field,
      ErrorCodes.VALIDATION_TOO_LONG
    );
  }
  return trimmed;
};

/**
 * アップロードファイル全体のバリデーション
 */
export const validateUploadFile = (
  file: File
): { type: SecretBoxItemType; name: string; mimeType: string; size: number } => {
  validateFileSize(file.size);
  const type = validateMimeType(file.type);
  const name = validateFileName(file.name);

  return {
    type,
    name,
    mimeType: file.type,
    size: file.size,
  };
};
