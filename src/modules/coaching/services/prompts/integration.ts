/**
 * 苫米地式コーチング - 統合フェーズのプロンプト
 */

// フェーズ開始メッセージ
export const INTEGRATION_OPENING = `素晴らしいセッションでしたね。ここまでの対話を一緒に振り返ってみましょう。

今日のセッションで、一番印象に残っていることは何ですか？`;

// 質問パターン
export const INTEGRATION_QUESTIONS = {
  // 振り返り
  reflection: [
    "今日のセッションで、一番の気づきは何でしたか？",
    "セッションを通じて、何か変化を感じましたか？",
    "最初に話していたことと、今の気持ちを比べると、どう違いますか？",
  ],

  // ゴールの確認
  goalReview: [
    "今日見つけたゴールを、改めて言葉にしてみてください",
    "そのゴールに対して、今どんな気持ちですか？",
    "このゴールは、本当にあなたの「Want to」ですか？",
  ],

  // アファメーションの確認
  affirmationReview: [
    "今日作ったアファメーションを、もう一度言ってみてください",
    "その言葉を口にすると、どんな感覚がありますか？",
    "毎日この言葉を唱えることはできそうですか？",
  ],

  // 次のアクション
  nextAction: [
    "今日の気づきを活かして、明日から何をしますか？",
    "最初の一歩として、今週中にできることは何ですか？",
    "このセッションの後、最初にやりたいことは何ですか？",
  ],

  // 成長の認識
  growth: [
    "今日の自分を、セッション前の自分に紹介するとしたら、何と言いますか？",
    "あなたの中で、何が育ち始めていると感じますか？",
    "今日の経験を、未来の自分へのプレゼントだとしたら、それは何ですか？",
  ],

  // クロージング
  closing: [
    "今日のセッションを一言で表すと？",
    "このセッションを、どんな気持ちで終えたいですか？",
    "最後に、自分に伝えたいことはありますか？",
  ],
};

export const selectQuestion = (
  type: keyof typeof INTEGRATION_QUESTIONS
): string => {
  const questions = INTEGRATION_QUESTIONS[type];
  return questions[Math.floor(Math.random() * questions.length)];
};

/**
 * 会話内容に基づいて質問タイプを決定
 */
export const determineQuestionType = (
  turn: number,
  history: Array<{ role: "coach" | "user"; content: string }>
): keyof typeof INTEGRATION_QUESTIONS => {
  // 直近のユーザーメッセージを取得
  const recentUserMessages = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content);

  const lastMessage = recentUserMessages[recentUserMessages.length - 1] || "";

  // ゴール関連の話題を検出
  const goalKeywords = ["ゴール", "目標", "達成", "なりたい", "やりたい", "夢"];
  const hasGoalTopic = goalKeywords.some((kw) => lastMessage.includes(kw));

  // アファメーション関連の話題を検出
  const affirmationKeywords = ["私は", "自分は", "言葉", "唱える", "宣言"];
  const hasAffirmationTopic = affirmationKeywords.some((kw) => lastMessage.includes(kw));

  // アクション関連の話題を検出
  const actionKeywords = ["する", "やる", "始める", "明日", "今週", "一歩"];
  const hasActionTopic = actionKeywords.some((kw) => lastMessage.includes(kw));

  // 満足・感謝を検出
  const satisfactionKeywords = ["よかった", "嬉しい", "ありがとう", "気づけた", "わかった"];
  const hasSatisfaction = satisfactionKeywords.some((kw) => lastMessage.includes(kw));

  // 序盤は振り返り
  if (turn <= 1) {
    return "reflection";
  }

  // 満足が示されている場合は成長の認識またはクロージング
  if (hasSatisfaction) {
    return turn >= 5 ? "closing" : "growth";
  }

  // ゴールの話題が出ている場合
  if (hasGoalTopic) {
    return "goalReview";
  }

  // アファメーションの話題が出ている場合
  if (hasAffirmationTopic) {
    return "affirmationReview";
  }

  // アクションの話題が出ている場合
  if (hasActionTopic) {
    return "nextAction";
  }

  // ゴールとアファメーションの確認
  if (turn <= 3) {
    return Math.random() > 0.5 ? "goalReview" : "affirmationReview";
  }

  // 次のアクションと成長
  if (turn <= 5) {
    return Math.random() > 0.5 ? "nextAction" : "growth";
  }

  // クロージング
  return "closing";
};

// ユーザーメッセージに対する受け止め応答パターン
const ACKNOWLEDGMENT_PATTERNS = [
  "素晴らしいですね。",
  "とても良い気づきですね。",
  "ありがとうございます。",
  "大切なことですね。",
  "いい言葉ですね。",
];

// クロージング用の締め応答パターン
const CLOSING_MESSAGES = [
  "今日のセッションはここまでにしましょう。お話しいただきありがとうございました。今日の気づきを大切に、一歩ずつ進んでいってください。",
  "今日はここまでにしましょう。素敵なセッションでした。これからの歩みを応援しています。",
  "今日のセッションはお疲れ様でした。新しい気づきとともに、あなたらしい一歩を踏み出してください。",
];

// 会話履歴からコーチの応答を生成（GPTなしで直接応答を返す）
export const generateIntegrationPrompt = (
  turn: number,
  history: Array<{ role: "coach" | "user"; content: string }>,
  userMessage: string
): string => {
  const questionType = determineQuestionType(turn, history);

  // クロージングの場合は締めのメッセージを返す
  if (questionType === "closing") {
    return CLOSING_MESSAGES[Math.floor(Math.random() * CLOSING_MESSAGES.length)];
  }

  const question = selectQuestion(questionType);
  const acknowledgment =
    ACKNOWLEDGMENT_PATTERNS[
      Math.floor(Math.random() * ACKNOWLEDGMENT_PATTERNS.length)
    ];

  return `${acknowledgment}${question}`;
};

// セッションサマリー生成用
export const generateSessionSummary = (
  goals: string[],
  scotomas: string[],
  affirmations: string[]
): string => {
  let summary = "## 今日のセッションまとめ\n\n";

  if (goals.length > 0) {
    summary += "### 見つけたゴール\n";
    goals.forEach((goal) => {
      summary += `- ${goal}\n`;
    });
    summary += "\n";
  }

  if (scotomas.length > 0) {
    summary += "### 気づいたスコトーマ（盲点）\n";
    scotomas.forEach((scotoma) => {
      summary += `- ${scotoma}\n`;
    });
    summary += "\n";
  }

  if (affirmations.length > 0) {
    summary += "### 作成したアファメーション\n";
    affirmations.forEach((affirmation) => {
      summary += `- ${affirmation}\n`;
    });
    summary += "\n";
  }

  summary +=
    "---\n\n今日の気づきを大切に、一歩ずつ進んでいきましょう。\n";

  return summary;
};
