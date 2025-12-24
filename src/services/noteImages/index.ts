/**
 * ノート画像サービス
 */

import {
  findImagesByNoteId,
  findImageById,
  findImageData,
  createImage,
  deleteImage,
  deleteImagesByNoteId,
  type NoteImageMeta,
  type CreateNoteImageParams,
} from "../../repositories/noteImagesRepo";
import { findNoteById } from "../../repositories/notesRepo";

// 画像サイズ制限（10MB）
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

// 許可するMIMEタイプ
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/**
 * ノートに紐づく画像一覧を取得
 */
export const getNoteImages = async (noteId: string): Promise<NoteImageMeta[]> => {
  return await findImagesByNoteId(noteId);
};

/**
 * 画像メタデータを取得
 */
export const getNoteImage = async (id: string): Promise<NoteImageMeta> => {
  const image = await findImageById(id);
  if (!image) {
    throw new Error("Not found");
  }
  return image;
};

/**
 * 画像データを取得
 */
export const getNoteImageData = async (
  id: string
): Promise<{ data: Buffer; mimeType: string; size: number }> => {
  const result = await findImageData(id);
  if (!result) {
    throw new Error("Not found");
  }
  return result;
};

/**
 * 画像をアップロード（File オブジェクトから）
 */
export const uploadNoteImage = async (
  noteId: string,
  file: File,
  options?: { name?: string }
): Promise<NoteImageMeta> => {
  // ノートの存在確認
  const note = await findNoteById(noteId);
  if (!note) {
    throw new Error(`Note not found: ${noteId}`);
  }

  // バリデーション
  validateImageSize(file.size);
  validateMimeType(file.type);

  const name = options?.name || file.name || "image";

  // ファイルデータ読み込み
  const arrayBuffer = await file.arrayBuffer();
  const data = Buffer.from(arrayBuffer);

  const params: CreateNoteImageParams = {
    noteId,
    name,
    mimeType: file.type,
    size: file.size,
    data,
  };

  return await createImage(params);
};

/**
 * 画像をアップロード（Base64から）- GPT経由用
 */
export const uploadNoteImageFromBase64 = async (
  noteId: string,
  base64Data: string,
  options?: { name?: string; mimeType?: string }
): Promise<NoteImageMeta> => {
  // ノートの存在確認
  const note = await findNoteById(noteId);
  if (!note) {
    throw new Error(`Note not found: ${noteId}`);
  }

  // Base64デコード
  const data = Buffer.from(base64Data, "base64");
  const size = data.length;

  // バリデーション
  validateImageSize(size);

  // MIMEタイプを決定（指定がなければpng）
  const mimeType = options?.mimeType || "image/png";
  validateMimeType(mimeType);

  const name = options?.name || `image.${getExtension(mimeType)}`;

  const params: CreateNoteImageParams = {
    noteId,
    name,
    mimeType,
    size,
    data,
  };

  return await createImage(params);
};

/**
 * 画像を削除
 */
export const removeNoteImage = async (id: string): Promise<NoteImageMeta> => {
  const image = await deleteImage(id);
  if (!image) {
    throw new Error("Not found");
  }
  return image;
};

/**
 * ノートに紐づく全画像を削除
 */
export const removeNoteImagesByNoteId = async (noteId: string): Promise<number> => {
  return await deleteImagesByNoteId(noteId);
};

// --- バリデーション ---

function validateImageSize(size: number): void {
  if (size > MAX_IMAGE_SIZE) {
    throw new Error(
      `ファイルサイズが大きすぎます。最大${MAX_IMAGE_SIZE / 1024 / 1024}MBまでアップロードできます。`
    );
  }
}

function validateMimeType(mimeType: string): void {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error(
      `サポートされていない画像形式です。対応形式: ${ALLOWED_MIME_TYPES.join(", ")}`
    );
  }
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return map[mimeType] || "png";
}
