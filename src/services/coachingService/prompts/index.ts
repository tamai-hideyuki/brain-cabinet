/**
 * 苫米地式コーチング - プロンプト統合エクスポート
 */

export { SYSTEM_PROMPT, getSystemPromptWithPhase } from "./systemPrompt";

export {
  OPENING_MESSAGE as GOAL_SETTING_OPENING,
  GOAL_SETTING_QUESTIONS,
  generateGoalSettingPrompt,
} from "./goalSetting";

export {
  ABSTRACTION_OPENING,
  ABSTRACTION_QUESTIONS,
  generateAbstractionPrompt,
} from "./abstraction";

export {
  SELF_TALK_OPENING,
  SELF_TALK_QUESTIONS,
  generateSelfTalkPrompt,
} from "./selfTalk";

export {
  INTEGRATION_OPENING,
  INTEGRATION_QUESTIONS,
  generateIntegrationPrompt,
  generateSessionSummary,
} from "./integration";
