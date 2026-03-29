/**
 * ノートモジュール
 * 公開インターフェース
 */
export { notesRoute } from "./routes";
export { noteDispatcher } from "./dispatcher";

// 他モジュールが参照するサービス
export {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  restoreNote,
  getDeletedNotes,
  revertNote,
  batchDeleteNotes,
  batchUpdateCategory,
} from "./service";

export {
  getNoteHistory,
  getHistoryHtmlDiff,
  getNoteFullContext,
  getNoteWithHistory,
  getSingleHistory,
  getNoteHistoryPaginated,
  getHistoryById,
} from "./historyService";

export {
  getNoteImages,
  getNoteImage,
  getNoteImageData,
  uploadNoteImage,
  removeNoteImage,
  uploadNoteImageFromBase64,
} from "./imageService";

// 他モジュールが参照するリポジトリ
export {
  findAllNotes,
  findNoteById,
  findNotesByIds,
  createNoteInDB,
  updateNoteInDB,
  softDeleteNoteInDB,
  restoreNoteInDB,
  findDeletedNotes,
  updateNotesCategoryInDB,
  purgeExpiredDeletedNotes,
} from "./repository";

export {
  insertHistory,
  findHistoryByNoteId,
  findHistoryById,
  countHistoryByNoteId,
  deleteHistoryByNoteIdRaw,
} from "./historyRepository";

export {
  deleteImagesByNoteIdRaw,
} from "./imageRepository";

// リレーション
export {
  deleteRelationsBySourceNote,
  createRelations,
  deleteAllRelationsForNoteRaw,
} from "./relationRepository";
