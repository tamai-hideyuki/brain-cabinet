/**
 * 苫米地式コーチング - ゴール設定フェーズのプロンプト
 */

// 初回の開始メッセージ
export const OPENING_MESSAGE = `こんにちは。今日は一緒に、あなたが本当に望む未来について考えていきましょう。

まずは、今どんなことが気になっていますか？仕事のこと、プライベートのこと、なんでも構いません。自由にお話しください。`;

// ターン別の質問パターン
export const GOAL_SETTING_QUESTIONS = {
  // 現状確認
  currentState: [
    "今の状況について、もう少し詳しく教えていただけますか？",
    "そのことについて、今どんな気持ちでいらっしゃいますか？",
    "最近、特に意識していることはありますか？",
  ],

  // Want to 確認
  wantTo: [
    "それは「やらなければならない」ことですか？それとも「本当にやりたい」ことですか？",
    "もし誰からも強制されていないとしたら、それでもやりたいですか？",
    "心からワクワクすることは何ですか？",
  ],

  // 現状の外へ
  outsideCurrentState: [
    "制限がなかったら、本当はどうしたいですか？",
    "そのゴールは、今の延長線上で達成できそうですか？それとも今の自分では想像しにくいものですか？",
    "もっと大きく考えてみると、どんな可能性がありますか？",
    "今の自分には達成方法が全く分からない、けれど心から望むことは何ですか？",
  ],

  // 臨場感を高める
  vivid: [
    "そのゴールを達成した自分は、朝起きてどんな気分ですか？",
    "その世界で、あなたはどんな生活をしていますか？",
    "その状態を想像すると、体にどんな感覚がありますか？",
    "その未来にいる自分から、今の自分を見るとどう見えますか？",
  ],

  // バランスホイール
  balanceWheel: [
    "仕事以外の分野（健康・家庭・趣味・社会貢献）ではどんなゴールがありますか？",
    "人生全体を見たとき、他にも大切にしたい領域はありますか？",
    "あなたにとって「豊かな人生」とは、どんな状態ですか？",
  ],
};

// 質問タイプに基づいて質問を選択
export const selectQuestion = (
  type: keyof typeof GOAL_SETTING_QUESTIONS
): string => {
  const questions = GOAL_SETTING_QUESTIONS[type];
  return questions[Math.floor(Math.random() * questions.length)];
};

// ターン数と会話内容に基づいて次の質問タイプを決定
export const determineQuestionType = (
  turn: number,
  history: Array<{ role: "coach" | "user"; content: string }>
): keyof typeof GOAL_SETTING_QUESTIONS => {
  // 序盤は現状確認
  if (turn <= 2) {
    return "currentState";
  }

  // 中盤はWant toと現状の外
  if (turn <= 4) {
    return Math.random() > 0.5 ? "wantTo" : "outsideCurrentState";
  }

  // 後半は臨場感とバランス
  if (turn <= 6) {
    return Math.random() > 0.5 ? "vivid" : "balanceWheel";
  }

  // それ以降はランダム
  const types = Object.keys(GOAL_SETTING_QUESTIONS) as Array<
    keyof typeof GOAL_SETTING_QUESTIONS
  >;
  return types[Math.floor(Math.random() * types.length)];
};

// ユーザーメッセージに対する受け止め応答パターン
const ACKNOWLEDGMENT_PATTERNS = [
  "なるほど、",
  "そうなんですね。",
  "ありがとうございます。",
  "お話しいただき、ありがとうございます。",
  "興味深いですね。",
];

// ユーザーメッセージから主題を抽出して受け止め応答を生成
const generateAcknowledgment = (userMessage: string): string => {
  const acknowledgment =
    ACKNOWLEDGMENT_PATTERNS[
      Math.floor(Math.random() * ACKNOWLEDGMENT_PATTERNS.length)
    ];
  return acknowledgment;
};

// 会話履歴からコーチの応答を生成（GPTなしで直接応答を返す）
export const generateGoalSettingPrompt = (
  turn: number,
  history: Array<{ role: "coach" | "user"; content: string }>,
  userMessage: string
): string => {
  const questionType = determineQuestionType(turn, history);
  const question = selectQuestion(questionType);
  const acknowledgment = generateAcknowledgment(userMessage);

  return `${acknowledgment}${question}`;
};
