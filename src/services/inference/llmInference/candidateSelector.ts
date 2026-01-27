/**
 * LLM推論候補セレクター
 *
 * LLM推論を実行すべきノート候補を抽出する
 */

import * as inferenceRepo from "../../../repositories/inferenceRepo";
import { logger } from "../../../utils/logger";
import { BATCH_CONFIG } from "./types";

// ============================================================
// 型定義
// ============================================================

export type LlmInferenceCandidate = {
  noteId: string;
  title: string;
  content: string;
  currentType: string;
  currentConfidence: number;
  reason: string;
};

export type GetCandidatesOptions = {
  limit?: number;
  confidenceThreshold?: number;
};

// ============================================================
// 候補抽出
// ============================================================

/**
 * LLM推論を実行すべきノート候補を取得する
 *
 * 優先順位:
 * 1. 推論履歴がないノート
 * 2. confidence < 0.5 のノート
 * 3. scratch タイプで更新日が新しいノート
 */
export async function getLlmInferenceCandidates(
  options: GetCandidatesOptions = {}
): Promise<LlmInferenceCandidate[]> {
  const limit = options.limit ?? BATCH_CONFIG.MAX_CANDIDATES;
  const confidenceThreshold = options.confidenceThreshold ?? 0.5;

  logger.debug({ limit, confidenceThreshold }, "Getting LLM inference candidates");

  // 既にLLM推論済みのノートIDを取得（保留中・承認済み・却下以外も含む）
  const existingNoteIds = await inferenceRepo.findExistingLlmNoteIds();

  // 候補リストを構築
  const candidates: LlmInferenceCandidate[] = [];

  // 1. 推論履歴がないノート（LLM推論未実行）
  if (candidates.length < limit) {
    const noInferenceNotes = await inferenceRepo.findNotesWithoutLlmInference(
      existingNoteIds,
      limit - candidates.length
    );

    for (const note of noInferenceNotes) {
      // ルールベース推論があるか確認
      const ruleInference = await inferenceRepo.findLatestInferenceBasic(note.id);

      const currentType = ruleInference?.type ?? "unknown";
      const currentConfidence = ruleInference?.confidence ?? 0;

      candidates.push({
        noteId: note.id,
        title: note.title,
        content: note.content,
        currentType,
        currentConfidence,
        reason: "LLM推論未実行",
      });
    }
  }

  // 2. confidence < threshold のノート（低信頼度）
  if (candidates.length < limit) {
    const lowConfidenceNotes = await inferenceRepo.findLowConfidenceInferences(
      confidenceThreshold,
      existingNoteIds,
      limit - candidates.length
    );

    // 既に追加済みのノートIDを除外
    const addedNoteIds = new Set(candidates.map((c) => c.noteId));

    for (const inference of lowConfidenceNotes) {
      if (addedNoteIds.has(inference.noteId)) continue;

      const noteData = await inferenceRepo.findNoteBasicInfo(inference.noteId);

      if (!noteData) continue;

      candidates.push({
        noteId: inference.noteId,
        title: noteData.title,
        content: noteData.content,
        currentType: inference.type,
        currentConfidence: inference.confidence,
        reason: `低信頼度 (${(inference.confidence * 100).toFixed(0)}%)`,
      });
      addedNoteIds.add(inference.noteId);
    }
  }

  // 3. scratch タイプで更新日が新しいノート
  if (candidates.length < limit) {
    const scratchNotes = await inferenceRepo.findScratchTypeNotes(
      existingNoteIds,
      limit - candidates.length
    );

    const addedNoteIds = new Set(candidates.map((c) => c.noteId));

    for (const inference of scratchNotes) {
      if (addedNoteIds.has(inference.noteId)) continue;

      const noteData = await inferenceRepo.findNoteBasicInfo(inference.noteId);

      if (!noteData) continue;

      candidates.push({
        noteId: inference.noteId,
        title: noteData.title,
        content: noteData.content,
        currentType: "scratch",
        currentConfidence: inference.confidence,
        reason: "scratchタイプ（再分類候補）",
      });
      addedNoteIds.add(inference.noteId);
    }
  }

  logger.info({ count: candidates.length }, "LLM inference candidates found");
  return candidates;
}

/**
 * 候補数をカウント（コスト見積もり用）
 */
export async function countLlmInferenceCandidates(
  options: GetCandidatesOptions = {}
): Promise<number> {
  const candidates = await getLlmInferenceCandidates(options);
  return candidates.length;
}
