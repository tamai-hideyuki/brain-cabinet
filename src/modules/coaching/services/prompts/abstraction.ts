/**
 * 苫米地式コーチング - 抽象度操作フェーズのプロンプト
 */

// フェーズ開始メッセージ
export const ABSTRACTION_OPENING = `さて、ここからは少し視点を上げて考えてみましょう。

今話してくださったことを、もう一段高いところから眺めてみると、何が見えてきますか？`;

// 質問パターン
export const ABSTRACTION_QUESTIONS = {
  // 視点を上げる
  raiseView: [
    "さらに視点を上げると何が見えますか？",
    "この状況の背景にはどんな構造があるのでしょう？",
    "もっと大きな文脈で考えると、これは何についての話ですか？",
    "この問題の本質は何だと思いますか？",
  ],

  // ロールプレイ
  rolePlay: [
    "もしあなたが社長の立場だったらどう考えますか？",
    "あなたが憧れる○○さんなら今の状況をどう打開するでしょう？",
    "10年後の自分がこの状況を見たら、何と言うと思いますか？",
    "もし世界的なリーダーだったら、どんな判断をしますか？",
  ],

  // スコトーマ発見
  scotoma: [
    "見落としていることはありませんか？",
    "反対の視点から見ると、どう見えますか？",
    "他の誰かの目で見たら、何に気づきそうですか？",
    "「当たり前」だと思っていることの中に、盲点はありませんか？",
  ],

  // 抽象度を下げる
  lowerView: [
    "では具体的に明日から何ができますか？",
    "最初の一歩として、何をしますか？",
    "今週中にできる小さなアクションは何ですか？",
  ],

  // スコトーマ理論の説明
  scotomaExplanation: [
    "見つからない解決策は、単にスコトーマに隠れているだけかもしれません。何を「重要」とみなせば、その盲点が外れるでしょうか？",
    "私たちの脳は、自分にとって重要だと判断した情報だけを認識します。今、何が見えていないのでしょう？",
  ],
};

export const selectQuestion = (
  type: keyof typeof ABSTRACTION_QUESTIONS
): string => {
  const questions = ABSTRACTION_QUESTIONS[type];
  return questions[Math.floor(Math.random() * questions.length)];
};

/**
 * 会話内容に基づいて質問タイプを決定
 */
export const determineQuestionType = (
  turn: number,
  history: Array<{ role: "coach" | "user"; content: string }>
): keyof typeof ABSTRACTION_QUESTIONS => {
  // 直近のユーザーメッセージを取得
  const recentUserMessages = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content.toLowerCase());

  const lastMessage = recentUserMessages[recentUserMessages.length - 1] || "";

  // 具体的な話が続いている場合は視点を上げる
  const concreteKeywords = ["具体的", "例えば", "実際", "やり方", "方法", "どうすれば"];
  const isConcreteContext = concreteKeywords.some((kw) => lastMessage.includes(kw));

  // 抽象的な話が続いている場合は具体化を促す
  const abstractKeywords = ["本質", "意味", "なぜ", "そもそも", "根本", "価値"];
  const isAbstractContext = abstractKeywords.some((kw) => lastMessage.includes(kw));

  // 行き詰まりを示すキーワード
  const stuckKeywords = ["わからない", "見えない", "難しい", "無理", "できない"];
  const isStuck = stuckKeywords.some((kw) => lastMessage.includes(kw));

  // 序盤は視点を上げる
  if (turn <= 2) {
    return "raiseView";
  }

  // 行き詰まっている場合はスコトーマ発見を促す
  if (isStuck) {
    return Math.random() > 0.3 ? "scotoma" : "scotomaExplanation";
  }

  // 具体的な話が続いている場合は視点を上げる
  if (isConcreteContext) {
    return Math.random() > 0.5 ? "raiseView" : "rolePlay";
  }

  // 抽象的な話が続いている場合は具体化を促す
  if (isAbstractContext && turn > 4) {
    return "lowerView";
  }

  // 中盤はロールプレイやスコトーマ
  if (turn <= 4) {
    const types: Array<keyof typeof ABSTRACTION_QUESTIONS> = [
      "rolePlay",
      "scotoma",
      "scotomaExplanation",
    ];
    return types[Math.floor(Math.random() * types.length)];
  }

  // 後半は具体化も含める
  const types: Array<keyof typeof ABSTRACTION_QUESTIONS> = [
    "raiseView",
    "scotoma",
    "lowerView",
  ];
  return types[Math.floor(Math.random() * types.length)];
};

// ユーザーメッセージに対する受け止め応答パターン
const ACKNOWLEDGMENT_PATTERNS = [
  "なるほど、",
  "そうですね。",
  "興味深い視点ですね。",
  "おっしゃる通りですね。",
  "面白い考え方ですね。",
];

// 会話履歴からコーチの応答を生成（GPTなしで直接応答を返す）
export const generateAbstractionPrompt = (
  turn: number,
  history: Array<{ role: "coach" | "user"; content: string }>,
  userMessage: string
): string => {
  const questionType = determineQuestionType(turn, history);
  const question = selectQuestion(questionType);
  const acknowledgment =
    ACKNOWLEDGMENT_PATTERNS[
      Math.floor(Math.random() * ACKNOWLEDGMENT_PATTERNS.length)
    ];

  return `${acknowledgment}${question}`;
};
