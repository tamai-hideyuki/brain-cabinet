import TinySegmenter from "tiny-segmenter";
import { CATEGORIES, Category } from "../db/schema";

const segmenter = new TinySegmenter();

// -------------------------------------
// 見出し抽出
// -------------------------------------
export const extractHeadings = (content: string): string[] => {
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  const headings: string[] = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    headings.push(match[1].trim());
  }

  return headings;
};

// -------------------------------------
// タグ抽出
// -------------------------------------

// 英単語パターン（3文字以上）
const ENGLISH_WORD_REGEX = /\b[A-Za-z][A-Za-z0-9_-]{2,}\b/g;

// カタカナ語パターン（2文字以上）
const KATAKANA_REGEX = /[\u30A0-\u30FF]{2,}/g;

// ストップワード（除外する一般的な単語）
const STOP_WORDS = new Set([
  // 英語
  "the", "and", "for", "with", "that", "this", "from", "have", "not", "but",
  "are", "was", "were", "been", "being", "has", "had", "will", "would", "could",
  "should", "may", "might", "must", "can", "which", "what", "when", "where",
  "who", "how", "why", "all", "each", "every", "some", "any", "most", "other",
  "into", "over", "such", "only", "also", "than", "then", "now", "here", "there",
  "just", "more", "very", "about", "through", "between", "under", "after", "before",
  // プログラミング一般（コードブロック内でよく出る）
  "const", "let", "var", "function", "return", "import", "export", "default",
  "class", "extends", "implements", "interface", "type", "async", "await",
  "true", "false", "null", "undefined", "new", "delete", "typeof", "instanceof",
]);

// 技術用語の重み付け（これらは優先的にタグ化）
const TECH_TERMS = new Set([
  // 言語・フレームワーク
  "typescript", "javascript", "python", "rust", "golang", "java", "ruby",
  "react", "vue", "angular", "svelte", "nextjs", "nuxt", "hono", "express",
  "fastapi", "django", "flask", "rails", "spring",
  // ツール・インフラ
  "docker", "kubernetes", "aws", "gcp", "azure", "terraform", "ansible",
  "github", "gitlab", "jenkins", "circleci", "vercel", "netlify",
  // データベース
  "postgresql", "mysql", "sqlite", "mongodb", "redis", "elasticsearch",
  "drizzle", "prisma", "typeorm", "sequelize",
  // その他技術
  "graphql", "rest", "api", "websocket", "grpc", "oauth", "jwt",
  "openai", "gpt", "llm", "langchain", "vectordb", "rag",
]);

export const extractTags = (content: string, maxTags = 10): string[] => {
  const tagCounts = new Map<string, number>();

  // 1. 英単語を抽出
  const englishMatches = content.match(ENGLISH_WORD_REGEX) || [];
  for (const word of englishMatches) {
    const lower = word.toLowerCase();
    if (!STOP_WORDS.has(lower)) {
      tagCounts.set(lower, (tagCounts.get(lower) || 0) + 1);
    }
  }

  // 2. カタカナ語を抽出
  const katakanaMatches = content.match(KATAKANA_REGEX) || [];
  for (const word of katakanaMatches) {
    tagCounts.set(word, (tagCounts.get(word) || 0) + 1);
  }

  // 3. 日本語の重要語（TinySegmenter で形態素解析）
  const tokens = segmenter.segment(content);
  const japaneseWords = tokens.filter(
    (t: string) =>
      t.length >= 2 &&
      /^[\u3040-\u309F\u4E00-\u9FAF]+$/.test(t) && // ひらがな・漢字
      !/^(する|こと|もの|ため|これ|それ|あれ|どれ|ここ|そこ|あそこ|どこ)$/.test(t) // ストップワード
  );

  for (const word of japaneseWords) {
    tagCounts.set(word, (tagCounts.get(word) || 0) + 1);
  }

  // 4. スコア計算（出現回数 + 技術用語ボーナス）
  const scored = Array.from(tagCounts.entries()).map(([tag, count]) => {
    let score = count;
    if (TECH_TERMS.has(tag.toLowerCase())) {
      score += 5; // 技術用語ボーナス
    }
    return { tag, score };
  });

  // 5. スコア順にソートして上位を返す
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTags)
    .map((item) => item.tag);
};

// -------------------------------------
// カテゴリ分類
// -------------------------------------

// カテゴリごとのキーワード
const CATEGORY_KEYWORDS: Record<Category, string[]> = {
  技術: [
    "typescript", "javascript", "python", "api", "データベース", "実装",
    "コード", "プログラミング", "開発", "バグ", "エラー", "デバッグ",
    "アルゴリズム", "フレームワーク", "ライブラリ", "サーバー", "クライアント",
    "react", "vue", "node", "docker", "aws", "github", "git",
  ],
  心理: [
    "心理", "メンタル", "感情", "ストレス", "不安", "うつ", "認知",
    "行動", "習慣", "モチベーション", "自己", "意識", "無意識",
    "トラウマ", "セラピー", "カウンセリング", "マインド",
  ],
  健康: [
    "健康", "運動", "食事", "睡眠", "栄養", "ダイエット", "筋トレ",
    "有酸素", "ストレッチ", "瞑想", "呼吸", "姿勢", "疲労", "回復",
    "サプリ", "ビタミン", "プロテイン",
  ],
  仕事: [
    "仕事", "キャリア", "転職", "面接", "スキル", "マネジメント",
    "チーム", "プロジェクト", "タスク", "会議", "資料", "報告",
    "上司", "部下", "同僚", "クライアント", "納期", "評価",
  ],
  人間関係: [
    "人間関係", "コミュニケーション", "家族", "友人", "恋愛", "結婚",
    "会話", "傾聴", "共感", "信頼", "対立", "解決", "境界線",
  ],
  学習: [
    "学習", "勉強", "読書", "本", "教育", "スキル", "知識",
    "理解", "記憶", "復習", "ノート", "メモ", "インプット", "アウトプット",
  ],
  アイデア: [
    "アイデア", "発想", "企画", "提案", "仮説", "実験", "検証",
    "創造", "イノベーション", "ブレスト", "思考", "構想",
  ],
  走り書き: [
    "メモ", "todo", "あとで", "覚書", "雑記", "思いつき",
  ],
  その他: [],
};

export const classifyCategory = (content: string, title: string): Category => {
  const text = (title + " " + content).toLowerCase();

  let bestCategory: Category = "その他";
  let bestScore = 0;

  for (const category of CATEGORIES) {
    const keywords = CATEGORY_KEYWORDS[category];
    let score = 0;

    for (const keyword of keywords) {
      const regex = new RegExp(keyword, "gi");
      const matches = text.match(regex);
      if (matches) {
        score += matches.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return bestCategory;
};

// -------------------------------------
// 統合メタデータ抽出
// -------------------------------------
export interface NoteMetadata {
  headings: string[];
  tags: string[];
  category: Category;
}

export const extractMetadata = (content: string, title: string): NoteMetadata => {
  return {
    headings: extractHeadings(content),
    tags: extractTags(content),
    category: classifyCategory(content, title),
  };
};
