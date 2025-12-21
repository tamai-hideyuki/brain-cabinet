import { CATEGORIES, Category } from "../../db/schema";
import { tokenize } from "../tokenizer";

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
  // 英語一般
  "the", "and", "for", "with", "that", "this", "from", "have", "not", "but",
  "are", "was", "were", "been", "being", "has", "had", "will", "would", "could",
  "should", "may", "might", "must", "can", "which", "what", "when", "where",
  "who", "how", "why", "all", "each", "every", "some", "any", "most", "other",
  "into", "over", "such", "only", "also", "than", "then", "now", "here", "there",
  "just", "more", "very", "about", "through", "between", "under", "after", "before",
  "like", "make", "use", "using", "used", "get", "set", "add", "put", "take",
  "see", "look", "know", "think", "want", "need", "try", "come", "give", "tell",
  // プログラミング予約語（タグとして不要）
  "const", "let", "var", "function", "return", "import", "export", "default",
  "class", "extends", "implements", "interface", "type", "async", "await",
  "true", "false", "null", "undefined", "new", "delete", "typeof", "instanceof",
  "if", "else", "switch", "case", "break", "continue", "while", "do", "for",
  "try", "catch", "finally", "throw", "throws", "public", "private", "protected",
  "static", "final", "abstract", "void", "int", "string", "boolean", "number",
]);

// 日本語ストップワード
const JAPANESE_STOP_WORDS = new Set([
  "する", "こと", "もの", "ため", "これ", "それ", "あれ", "どれ",
  "ここ", "そこ", "あそこ", "どこ", "この", "その", "あの", "どの",
  "なる", "ある", "いる", "できる", "れる", "られる", "せる", "させる",
  "ない", "ます", "です", "だ", "である", "という", "として", "について",
  "から", "まで", "より", "ほど", "など", "くらい", "ぐらい",
  "ので", "のに", "けど", "けれど", "しかし", "でも", "だが", "ただし",
  "また", "そして", "それで", "だから", "したがって", "ところで", "さて",
  "とき", "ところ", "ほう", "わけ", "はず", "つもり", "よう", "みたい",
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

  // 3. 日本語の重要語（形態素解析）
  const tokens = tokenize(content);
  const japaneseWords = tokens.filter(
    (t: string) =>
      t.length >= 2 &&
      /^[\u3040-\u309F\u4E00-\u9FAF]+$/.test(t) && // ひらがな・漢字
      !JAPANESE_STOP_WORDS.has(t) // 日本語ストップワード除外
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

// カテゴリごとのキーワード（重み付き）
// weight: 1 = 通常, 2 = 強い指標, 3 = 決定的
type WeightedKeyword = { word: string; weight: number };

const CATEGORY_KEYWORDS: Record<Category, WeightedKeyword[]> = {
  技術: [
    // 決定的（これがあればほぼ技術）
    { word: "typescript", weight: 3 }, { word: "javascript", weight: 3 },
    { word: "python", weight: 3 }, { word: "rust", weight: 3 }, { word: "golang", weight: 3 },
    { word: "react", weight: 3 }, { word: "vue", weight: 3 }, { word: "angular", weight: 3 },
    { word: "docker", weight: 3 }, { word: "kubernetes", weight: 3 },
    { word: "aws", weight: 3 }, { word: "gcp", weight: 3 }, { word: "azure", weight: 3 },
    // 強い指標
    { word: "api", weight: 2 }, { word: "データベース", weight: 2 }, { word: "db", weight: 2 },
    { word: "実装", weight: 2 }, { word: "コード", weight: 2 }, { word: "プログラミング", weight: 2 },
    { word: "開発", weight: 2 }, { word: "バグ", weight: 2 }, { word: "エラー", weight: 2 },
    { word: "デバッグ", weight: 2 }, { word: "github", weight: 2 }, { word: "git", weight: 2 },
    // 通常
    { word: "アルゴリズム", weight: 1 }, { word: "フレームワーク", weight: 1 },
    { word: "ライブラリ", weight: 1 }, { word: "サーバー", weight: 1 }, { word: "クライアント", weight: 1 },
    { word: "関数", weight: 1 }, { word: "変数", weight: 1 }, { word: "クラス", weight: 1 },
  ],
  心理: [
    { word: "心理学", weight: 3 }, { word: "認知行動療法", weight: 3 }, { word: "cbt", weight: 3 },
    { word: "心理", weight: 2 }, { word: "メンタル", weight: 2 }, { word: "感情", weight: 2 },
    { word: "ストレス", weight: 2 }, { word: "不安", weight: 2 }, { word: "うつ", weight: 2 },
    { word: "認知", weight: 1 }, { word: "行動", weight: 1 }, { word: "習慣", weight: 1 },
    { word: "モチベーション", weight: 1 }, { word: "自己", weight: 1 }, { word: "意識", weight: 1 },
    { word: "トラウマ", weight: 2 }, { word: "セラピー", weight: 2 }, { word: "カウンセリング", weight: 2 },
  ],
  健康: [
    { word: "健康", weight: 2 }, { word: "運動", weight: 2 }, { word: "食事", weight: 2 },
    { word: "睡眠", weight: 2 }, { word: "栄養", weight: 2 }, { word: "ダイエット", weight: 2 },
    { word: "筋トレ", weight: 2 }, { word: "有酸素", weight: 2 }, { word: "ストレッチ", weight: 1 },
    { word: "瞑想", weight: 1 }, { word: "呼吸", weight: 1 }, { word: "姿勢", weight: 1 },
    { word: "疲労", weight: 1 }, { word: "回復", weight: 1 }, { word: "サプリ", weight: 1 },
    { word: "ビタミン", weight: 1 }, { word: "プロテイン", weight: 1 }, { word: "カロリー", weight: 1 },
  ],
  仕事: [
    { word: "仕事", weight: 2 }, { word: "キャリア", weight: 2 }, { word: "転職", weight: 2 },
    { word: "面接", weight: 2 }, { word: "マネジメント", weight: 2 }, { word: "リーダーシップ", weight: 2 },
    { word: "チーム", weight: 1 }, { word: "プロジェクト", weight: 1 }, { word: "タスク", weight: 1 },
    { word: "会議", weight: 1 }, { word: "資料", weight: 1 }, { word: "報告", weight: 1 },
    { word: "上司", weight: 1 }, { word: "部下", weight: 1 }, { word: "同僚", weight: 1 },
    { word: "クライアント", weight: 1 }, { word: "納期", weight: 1 }, { word: "評価", weight: 1 },
    { word: "給与", weight: 1 }, { word: "昇進", weight: 1 }, { word: "スキルアップ", weight: 1 },
  ],
  人間関係: [
    { word: "人間関係", weight: 3 }, { word: "コミュニケーション", weight: 2 },
    { word: "家族", weight: 2 }, { word: "友人", weight: 2 }, { word: "恋愛", weight: 2 },
    { word: "結婚", weight: 2 }, { word: "会話", weight: 1 }, { word: "傾聴", weight: 1 },
    { word: "共感", weight: 1 }, { word: "信頼", weight: 1 }, { word: "対立", weight: 1 },
    { word: "解決", weight: 1 }, { word: "境界線", weight: 1 }, { word: "距離感", weight: 1 },
  ],
  学習: [
    { word: "学習", weight: 2 }, { word: "勉強", weight: 2 }, { word: "読書", weight: 2 },
    { word: "本", weight: 1 }, { word: "教育", weight: 1 }, { word: "知識", weight: 1 },
    { word: "理解", weight: 1 }, { word: "記憶", weight: 1 }, { word: "復習", weight: 1 },
    { word: "ノート", weight: 1 }, { word: "インプット", weight: 1 }, { word: "アウトプット", weight: 1 },
    { word: "暗記", weight: 1 }, { word: "試験", weight: 1 }, { word: "資格", weight: 1 },
  ],
  アイデア: [
    { word: "アイデア", weight: 3 }, { word: "発想", weight: 2 }, { word: "企画", weight: 2 },
    { word: "提案", weight: 1 }, { word: "仮説", weight: 1 }, { word: "実験", weight: 1 },
    { word: "検証", weight: 1 }, { word: "創造", weight: 1 }, { word: "イノベーション", weight: 2 },
    { word: "ブレスト", weight: 2 }, { word: "思考", weight: 1 }, { word: "構想", weight: 1 },
  ],
  走り書き: [
    { word: "todo", weight: 3 }, { word: "あとで", weight: 2 }, { word: "覚書", weight: 2 },
    { word: "雑記", weight: 2 }, { word: "思いつき", weight: 2 }, { word: "メモ", weight: 1 },
    { word: "一旦", weight: 1 }, { word: "とりあえず", weight: 1 },
  ],
  その他: [],
};

export const classifyCategory = (content: string, title: string): Category => {
  const text = (title + " " + content).toLowerCase();
  const titleLower = title.toLowerCase();

  let bestCategory: Category = "その他";
  let bestScore = 0;

  for (const category of CATEGORIES) {
    const keywords = CATEGORY_KEYWORDS[category];
    let score = 0;

    for (const { word, weight } of keywords) {
      const regex = new RegExp(word, "gi");

      // タイトルでのマッチは2倍
      const titleMatches = titleLower.match(regex);
      if (titleMatches) {
        score += titleMatches.length * weight * 2;
      }

      // 本文でのマッチ
      const contentMatches = text.match(regex);
      if (contentMatches) {
        score += contentMatches.length * weight;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // 最低スコア閾値（あまりにも低いスコアは「その他」）
  if (bestScore < 2) {
    return "その他";
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
