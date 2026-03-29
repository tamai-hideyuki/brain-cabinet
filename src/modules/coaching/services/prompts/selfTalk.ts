/**
 * 苫米地式コーチング - セルフトーク改善フェーズのプロンプト
 */

// フェーズ開始メッセージ
export const SELF_TALK_OPENING = `ここからは、あなたの内側の声に耳を傾けてみましょう。

普段、自分に対してどんな言葉をかけていますか？心の中でよく繰り返す言葉や、「自分はこういう人間だ」と思っていることはありますか？`;

// 質問パターン
export const SELF_TALK_QUESTIONS = {
  // セルフトーク観察
  observe: [
    "最近、自分にどんな言葉をかけていますか？",
    "心の中でよく繰り返す言葉は何ですか？",
    "「自分はこういう人間だ」と思っていることは？",
    "困難な状況で、自分に何と言い聞かせていますか？",
  ],

  // ネガティブパターンの確認
  negativePattern: [
    "そのセルフトークはゴール達成の助けになっていますか？",
    "その言葉を聞くと、どんな気持ちになりますか？",
    "もしその言葉を毎日100回聞いたら、どんな自分になりそうですか？",
  ],

  // リフレーミング
  reframe: [
    "「自分には無理かも」を、どう言い換えられますか？",
    "「今のは私らしくない、次はこうしよう！」と言い換えてみてください",
    "その言葉を、ゴールを達成した自分ならどう言い換えますか？",
    "同じ状況を、ポジティブに表現するとどうなりますか？",
  ],

  // アファメーション作成
  affirmation: [
    "ゴールを達成した自分として、「私は〜である」と宣言してみてください",
    "今ここで、理想の自分を表現する言葉を作ってみましょう",
    "毎朝自分に言いたい、力が湧く言葉は何ですか？",
  ],

  // エフィカシー強化
  efficacy: [
    "その状態の自分は、どんな行動をとりますか？",
    "「自分ならできる」と感じる瞬間はいつですか？",
    "まだやったことはないけれど、自分にはできると信じていることは何ですか？",
    "根拠はなくても、なぜか自信を持てることはありますか？",
  ],

  // ドリームキラー対策
  dreamKiller: [
    "周りから「無理だよ」と言われたとき、どう感じますか？",
    "あなたのゴールを応援してくれる人は誰ですか？",
    "ネガティブな意見から、自分のエフィカシーを守る方法はありますか？",
  ],
};

export const selectQuestion = (
  type: keyof typeof SELF_TALK_QUESTIONS
): string => {
  const questions = SELF_TALK_QUESTIONS[type];
  return questions[Math.floor(Math.random() * questions.length)];
};

/**
 * 会話内容に基づいて質問タイプを決定
 */
export const determineQuestionType = (
  turn: number,
  history: Array<{ role: "coach" | "user"; content: string }>
): keyof typeof SELF_TALK_QUESTIONS => {
  // 直近のユーザーメッセージを取得
  const recentUserMessages = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content);

  const lastMessage = recentUserMessages[recentUserMessages.length - 1] || "";

  // ネガティブなセルフトークを検出
  const negativeKeywords = [
    "無理", "できない", "だめ", "苦手", "不安", "怖い",
    "自信がない", "失敗", "間違い", "嫌い"
  ];
  const hasNegative = negativeKeywords.some((kw) => lastMessage.includes(kw));

  // ポジティブな変化を検出
  const positiveKeywords = [
    "できる", "やりたい", "なりたい", "信じる", "挑戦",
    "成長", "変わりたい", "頑張る"
  ];
  const hasPositive = positiveKeywords.some((kw) => lastMessage.includes(kw));

  // 他者からの影響を検出
  const otherInfluenceKeywords = [
    "言われた", "周り", "親", "上司", "友達", "みんな",
    "社会", "普通", "常識"
  ];
  const hasOtherInfluence = otherInfluenceKeywords.some((kw) => lastMessage.includes(kw));

  // 序盤はセルフトーク観察
  if (turn <= 2) {
    return Math.random() > 0.5 ? "observe" : "negativePattern";
  }

  // 他者からの影響が見られる場合はドリームキラー対策
  if (hasOtherInfluence) {
    return "dreamKiller";
  }

  // ネガティブなセルフトークが見られる場合はリフレーミング
  if (hasNegative) {
    return "reframe";
  }

  // ポジティブな変化が見られる場合はアファメーション・エフィカシー強化
  if (hasPositive) {
    return Math.random() > 0.5 ? "affirmation" : "efficacy";
  }

  // 中盤はリフレーミング
  if (turn <= 4) {
    return "reframe";
  }

  // 後半はアファメーションとエフィカシー
  if (turn <= 6) {
    return Math.random() > 0.5 ? "affirmation" : "efficacy";
  }

  // それ以降はドリームキラー対策も含める
  const types: Array<keyof typeof SELF_TALK_QUESTIONS> = [
    "affirmation",
    "efficacy",
    "dreamKiller",
  ];
  return types[Math.floor(Math.random() * types.length)];
};

// ユーザーメッセージに対する受け止め応答パターン
const ACKNOWLEDGMENT_PATTERNS = [
  "ありがとうございます。",
  "お話しいただきありがとうございます。",
  "なるほど、そうなんですね。",
  "大切なことをお話しくださいましたね。",
  "素直にお話しくださり、ありがとうございます。",
];

// 会話履歴からコーチの応答を生成（GPTなしで直接応答を返す）
export const generateSelfTalkPrompt = (
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
