/**
 * GPT判断コーチング機能
 */

import { searchDecisions, getDecisionContext } from "../../decision";

// -------------------------------------
// 型定義
// -------------------------------------
export interface CoachDecisionResponse {
  query: string;
  pastDecisions: Array<{
    noteId: string;
    title: string;
    confidence: number;
    confidenceDetail?: {
      structural: number;
      experiential: number;
      temporal: number;
    };
    decayProfile: string;
    effectiveScore: number;
    reasoning: string;
    excerpt: string;
  }>;
  relatedLearnings: Array<{
    noteId: string;
    title: string;
    excerpt: string;
  }>;
  coachingAdvice: string;
}

// -------------------------------------
// 判断コーチング
// -------------------------------------

/**
 * 判断コーチング - 過去の判断を参照して意思決定を支援
 */
export const coachDecision = async (query: string): Promise<CoachDecisionResponse> => {
  // 1. 関連する過去の判断を検索
  const decisions = await searchDecisions(query, {
    minConfidence: 0.4,
    limit: 5,
  });

  // 2. 関連する学習ノートを収集
  const learningNotes: CoachDecisionResponse["relatedLearnings"] = [];
  const seenLearningIds = new Set<string>();

  for (const decision of decisions.slice(0, 3)) {
    const context = await getDecisionContext(decision.noteId);
    if (context) {
      for (const learning of context.relatedLearnings) {
        if (!seenLearningIds.has(learning.noteId)) {
          seenLearningIds.add(learning.noteId);
          learningNotes.push(learning);
        }
      }
    }
  }

  // 3. コーチングアドバイスを生成
  let coachingAdvice: string;

  if (decisions.length === 0) {
    coachingAdvice = `「${query}」に関連する過去の判断は見つかりませんでした。新しい判断を下す際は、理由と背景を明確にしてノートに残すことをお勧めします。`;
  } else {
    const topDecision = decisions[0];
    const decisionCount = decisions.length;

    coachingAdvice = `「${query}」に関連して、過去に${decisionCount}件の判断を行っています。

【最も関連する過去の判断】
${topDecision.title}
- 信頼度: ${(topDecision.confidence * 100).toFixed(0)}%
- 理由: ${topDecision.reasoning}

${decisions.length > 1 ? `他にも${decisions.length - 1}件の関連判断があります。` : ""}
${learningNotes.length > 0 ? `\n関連する学習ノートが${learningNotes.length}件あり、判断の根拠として参照できます。` : ""}

今回も同様の状況であれば、過去の判断を参考にできます。状況が異なる場合は、その違いを明確にした上で新しい判断を下しましょう。`;
  }

  return {
    query,
    pastDecisions: decisions.map((d) => ({
      noteId: d.noteId,
      title: d.title,
      confidence: d.confidence,
      confidenceDetail: d.confidenceDetail,
      decayProfile: d.decayProfile,
      effectiveScore: d.effectiveScore,
      reasoning: d.reasoning,
      excerpt: d.excerpt,
    })),
    relatedLearnings: learningNotes.slice(0, 5),
    coachingAdvice,
  };
};
