/**
 * System/Debug ドメイン ディスパッチャー
 */

import * as healthService from "../services/healthService";
import * as embeddingService from "../services/embeddingService";
import { findAllNotes } from "../repositories/notesRepo";
import { rebuildFTS } from "../repositories/ftsRepo";

export const systemDispatcher = {
  // system.health
  async health() {
    return healthService.performHealthCheck();
  },

  // debug.healthcheck（system.healthと同じ）
  async healthcheck() {
    return healthService.performHealthCheck();
  },

  // system.embed
  async embed(payload: unknown) {
    const p = payload as { text?: string } | undefined;
    if (!p?.text) {
      throw new Error("text is required");
    }
    const embedding = await embeddingService.generateEmbedding(p.text);
    return {
      text: p.text,
      embedding,
      dimensions: embedding.length,
    };
  },

  // embedding.recalcAll
  async recalcAll(payload: unknown) {
    const p = payload as { force?: boolean } | undefined;
    const force = p?.force ?? false;

    // 非同期で実行（完了を待たない）
    embeddingService.generateAllEmbeddings(() => {
      // プログレスはログに出力
    });

    return {
      message: "Embedding recalculation started",
      force,
    };
  },

  // system.rebuildFts
  async rebuildFts() {
    const allNotes = await findAllNotes();
    await rebuildFTS(allNotes);

    return {
      message: "FTS index rebuilt successfully",
      indexedCount: allNotes.length,
    };
  },
};
