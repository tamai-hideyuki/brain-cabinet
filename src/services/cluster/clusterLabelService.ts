/**
 * Cluster Label Service
 *
 * クラスタのラベルを自動生成するサービス
 * ノートの内容から特徴的なキーワードを抽出してラベルにする
 */

import { db } from "../../db/client";
import { sql } from "drizzle-orm";

// 日本語ストップワード（一般的すぎる単語を除外）
const STOP_WORDS = new Set([
  // 助詞・助動詞
  "の", "は", "が", "を", "に", "で", "と", "も", "や", "など",
  "から", "まで", "より", "へ", "として", "について", "における",
  "ため", "こと", "もの", "ところ", "よう", "とき", "ほう",
  // 一般的な動詞・形容詞
  "する", "ある", "いる", "なる", "できる", "思う", "考える",
  "使う", "見る", "行う", "持つ", "言う", "知る", "分かる",
  "良い", "悪い", "多い", "少ない", "大きい", "小さい",
  // 一般的な名詞
  "方法", "場合", "必要", "可能", "問題", "理由", "結果",
  "内容", "情報", "データ", "時間", "今日", "明日", "昨日",
  // 英語ストップワード
  "the", "a", "an", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "must", "can", "this",
  "that", "these", "those", "it", "its", "i", "you", "we",
  "they", "he", "she", "my", "your", "his", "her", "our",
  "their", "what", "which", "who", "when", "where", "why",
  "how", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "no", "not", "only", "same", "so",
  "than", "too", "very", "just", "but", "and", "or", "if",
  "because", "as", "until", "while", "of", "at", "by", "for",
  "with", "about", "against", "between", "into", "through",
  "during", "before", "after", "above", "below", "to", "from",
  "up", "down", "in", "out", "on", "off", "over", "under",
  "again", "further", "then", "once", "here", "there", "when",
  "where", "why", "how", "any", "both", "each", "few", "more",
]);

// 技術用語を優先するパターン
const TECH_PATTERNS = [
  /API/i, /UI/i, /UX/i, /DB/i, /SQL/i, /HTTP/i, /REST/i, /GraphQL/i,
  /React/i, /Vue/i, /Angular/i, /Node/i, /Python/i, /TypeScript/i, /JavaScript/i,
  /CSS/i, /HTML/i, /JSON/i, /XML/i, /YAML/i,
  /OAuth/i, /JWT/i, /Auth/i, /認証/i, /認可/i,
  /テスト/i, /デプロイ/i, /CI/i, /CD/i,
  /Docker/i, /Kubernetes/i, /AWS/i, /GCP/i, /Azure/i,
  /Git/i, /GitHub/i, /リファクタ/i, /設計/i, /アーキテクチャ/i,
];

/**
 * テキストからキーワードを抽出
 */
function extractKeywords(text: string): Map<string, number> {
  const wordFreq = new Map<string, number>();

  // 日本語と英語の単語を抽出
  // 日本語: 2文字以上のカタカナ・漢字の連続
  // 英語: 2文字以上のアルファベットの連続
  const patterns = [
    /[ァ-ヴー]{2,}/g,           // カタカナ
    /[一-龯々]{2,}/g,           // 漢字
    /[a-zA-Z][a-zA-Z0-9]{1,}/g, // 英語
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern) || [];
    for (const match of matches) {
      const word = match.toLowerCase();
      if (STOP_WORDS.has(word) || word.length < 2) continue;
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
  }

  return wordFreq;
}

/**
 * TF-IDF風のスコアリングでキーワードをランク付け
 */
function scoreKeywords(
  clusterWordFreq: Map<string, number>,
  globalWordFreq: Map<string, number>,
  totalDocs: number
): Array<{ word: string; score: number }> {
  const scores: Array<{ word: string; score: number }> = [];

  for (const [word, tf] of clusterWordFreq) {
    const df = globalWordFreq.get(word) || 1;
    // IDF = log(総ドキュメント数 / 出現ドキュメント数)
    const idf = Math.log((totalDocs + 1) / (df + 1));
    // TF-IDF スコア
    let score = tf * idf;

    // 技術用語にはボーナススコア
    if (TECH_PATTERNS.some((p) => p.test(word))) {
      score *= 1.5;
    }

    // 長すぎる単語にはペナルティ
    if (word.length > 15) {
      score *= 0.8;
    }

    scores.push({ word, score });
  }

  return scores.sort((a, b) => b.score - a.score);
}

/**
 * クラスタ内のノートからラベルを生成
 */
export async function generateClusterLabel(
  identityId: number
): Promise<string | null> {
  // クラスタに属するノートを取得
  const notes = await db.all<{ id: string; content: string; title: string | null }>(sql`
    SELECT n.id, n.content, n.title
    FROM notes n
    JOIN snapshot_note_assignments sna ON n.id = sna.note_id
    JOIN snapshot_clusters sc ON sna.snapshot_id = sc.snapshot_id AND sna.cluster_id = sc.id
    WHERE sc.identity_id = ${identityId}
    AND n.deleted_at IS NULL
    LIMIT 100
  `);

  if (notes.length === 0) {
    // 直接cluster_idで取得を試みる
    const directNotes = await db.all<{ id: string; content: string; title: string | null }>(sql`
      SELECT id, content, title
      FROM notes
      WHERE cluster_id IN (
        SELECT sc.local_id
        FROM snapshot_clusters sc
        WHERE sc.identity_id = ${identityId}
      )
      AND deleted_at IS NULL
      LIMIT 100
    `);

    if (directNotes.length === 0) {
      return null;
    }

    return generateLabelFromNotes(directNotes);
  }

  return generateLabelFromNotes(notes);
}

/**
 * ノート群からラベルを生成
 * 優先順位: 代表ノートのタイトル > キーワード抽出
 */
function generateLabelFromNotes(
  notes: Array<{ id: string; content: string; title: string | null }>
): string {
  // タイトルがあるノートを探す（最初に見つかったものを代表とする）
  const noteWithTitle = notes.find((n) => n.title && n.title.trim().length > 0);

  if (noteWithTitle && noteWithTitle.title) {
    // タイトルを整形（長すぎる場合は切り詰め）
    const title = noteWithTitle.title.trim();
    if (title.length <= 30) {
      return title;
    }
    // 30文字で切り詰めて「...」を追加
    return title.slice(0, 30) + "...";
  }

  // タイトルがない場合はキーワード抽出にフォールバック
  const clusterWordFreq = new Map<string, number>();

  for (const note of notes) {
    // 本文からのキーワード
    const contentKeywords = extractKeywords(note.content);
    for (const [word, count] of contentKeywords) {
      clusterWordFreq.set(word, (clusterWordFreq.get(word) || 0) + count);
    }
  }

  // スコアリング（簡易版：出現頻度ベース）
  const scored = Array.from(clusterWordFreq.entries())
    .map(([word, count]) => {
      let score = count;
      // 技術用語ボーナス
      if (TECH_PATTERNS.some((p) => p.test(word))) {
        score *= 2;
      }
      return { word, score };
    })
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return "不明";
  }

  // 上位2-3個のキーワードを組み合わせてラベルに
  const topKeywords = scored.slice(0, 3).map((s) => s.word);

  // 最も重要なキーワードを使用
  if (topKeywords.length === 1) {
    return topKeywords[0];
  }

  // 2つのキーワードを組み合わせ
  return `${topKeywords[0]}・${topKeywords[1]}`;
}

/**
 * 全アクティブクラスタのラベルを生成・更新
 * @param forceRegenerate - trueの場合、既存ラベルも再生成
 */
export async function generateAllClusterLabels(forceRegenerate = false): Promise<{
  updated: number;
  failed: number;
}> {
  // アクティブなクラスタを取得
  const identities = await db.all<{ id: number }>(
    forceRegenerate
      ? sql`SELECT id FROM cluster_identities WHERE is_active = 1`
      : sql`SELECT id FROM cluster_identities WHERE is_active = 1 AND (label IS NULL OR label = '')`
  );

  let updated = 0;
  let failed = 0;

  for (const identity of identities) {
    try {
      const label = await generateClusterLabel(identity.id);

      if (label) {
        await db.run(sql`
          UPDATE cluster_identities
          SET label = ${label}
          WHERE id = ${identity.id}
        `);
        updated++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`[ClusterLabel] Failed to generate label for identity ${identity.id}:`, error);
      failed++;
    }
  }

  return { updated, failed };
}

/**
 * 特定のクラスタのラベルを再生成
 */
export async function regenerateClusterLabel(identityId: number): Promise<string | null> {
  const label = await generateClusterLabel(identityId);

  if (label) {
    await db.run(sql`
      UPDATE cluster_identities
      SET label = ${label}
      WHERE id = ${identityId}
    `);
  }

  return label;
}
