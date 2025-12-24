/**
 * ノート画像リポジトリ
 */

import { db } from "../db/client";
import { noteImages } from "../db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

// メタデータ型（dataを除く）
export type NoteImageMeta = {
  id: string;
  noteId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: number;
};

// 作成パラメータ
export type CreateNoteImageParams = {
  noteId: string;
  name: string;
  mimeType: string;
  size: number;
  data: Buffer;
};

/**
 * ノートに紐づく画像一覧を取得
 */
export const findImagesByNoteId = async (noteId: string): Promise<NoteImageMeta[]> => {
  const rows = await db
    .select({
      id: noteImages.id,
      noteId: noteImages.noteId,
      name: noteImages.name,
      mimeType: noteImages.mimeType,
      size: noteImages.size,
      createdAt: noteImages.createdAt,
    })
    .from(noteImages)
    .where(eq(noteImages.noteId, noteId));

  return rows;
};

/**
 * 画像メタデータを取得
 */
export const findImageById = async (id: string): Promise<NoteImageMeta | null> => {
  const rows = await db
    .select({
      id: noteImages.id,
      noteId: noteImages.noteId,
      name: noteImages.name,
      mimeType: noteImages.mimeType,
      size: noteImages.size,
      createdAt: noteImages.createdAt,
    })
    .from(noteImages)
    .where(eq(noteImages.id, id));

  return rows[0] ?? null;
};

/**
 * 画像データを取得
 */
export const findImageData = async (
  id: string
): Promise<{ data: Buffer; mimeType: string; size: number } | null> => {
  const rows = await db
    .select({
      data: noteImages.data,
      mimeType: noteImages.mimeType,
      size: noteImages.size,
    })
    .from(noteImages)
    .where(eq(noteImages.id, id));

  if (rows.length === 0 || !rows[0].data) {
    return null;
  }

  return {
    data: rows[0].data as Buffer,
    mimeType: rows[0].mimeType,
    size: rows[0].size,
  };
};

/**
 * 画像を作成
 */
export const createImage = async (params: CreateNoteImageParams): Promise<NoteImageMeta> => {
  const id = randomUUID();
  const now = Math.floor(Date.now() / 1000);

  await db.insert(noteImages).values({
    id,
    noteId: params.noteId,
    name: params.name,
    mimeType: params.mimeType,
    size: params.size,
    data: params.data,
    createdAt: now,
  });

  return {
    id,
    noteId: params.noteId,
    name: params.name,
    mimeType: params.mimeType,
    size: params.size,
    createdAt: now,
  };
};

/**
 * 画像を削除
 */
export const deleteImage = async (id: string): Promise<NoteImageMeta | null> => {
  const existing = await findImageById(id);
  if (!existing) {
    return null;
  }

  await db.delete(noteImages).where(eq(noteImages.id, id));
  return existing;
};

/**
 * ノートに紐づく全画像を削除
 */
export const deleteImagesByNoteId = async (noteId: string): Promise<number> => {
  const images = await findImagesByNoteId(noteId);
  if (images.length === 0) {
    return 0;
  }

  await db.delete(noteImages).where(eq(noteImages.noteId, noteId));
  return images.length;
};
