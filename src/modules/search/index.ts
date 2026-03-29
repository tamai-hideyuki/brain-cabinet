/**
 * 検索モジュール
 * 公開インターフェース
 */
export { searchRoute } from "./routes";
export { searchDispatcher } from "./dispatcher";

// 検索サービス
export {
  searchNotes,
  searchNotesSemantic,
  searchNotesHybrid,
  invalidateIDFCache,
  type SearchResult,
} from "./service";

// エンベディングサービス
export {
  generateEmbedding,
  generateAndSaveNoteEmbedding,
  generateAllEmbeddings,
  searchSimilarNotes,
  findSimilarNotes,
  cosineSimilarity,
  semanticChangeScore,
  buildSearchIndex,
  type HNSWIndexStats,
} from "./embeddingService";

// リポジトリ（他モジュールが参照）
export {
  searchNotesInDB,
  type SearchOptions,
} from "./repository";

export {
  searchFTS,
  insertFTSRaw,
  updateFTSRaw,
  deleteFTSRaw,
  rebuildFTS,
  createFTSTable,
  checkFTSTableExists,
} from "./ftsRepository";

export {
  saveEmbedding,
  getEmbedding,
  deleteEmbedding,
  getAllEmbeddings,
  countEmbeddings,
  createEmbeddingTable,
  checkEmbeddingTableExists,
  deleteEmbeddingRaw,
  DEFAULT_MODEL,
  EMBEDDING_VERSION,
} from "./embeddingRepository";

// セマンティック変化
export { analyzeSemanticChange, serializeChangeDetail } from "./semanticChangeService";
