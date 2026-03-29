/**
 * GPT連携サービス
 * - GPTが使いやすい形式でデータを提供
 * - 複合検索
 * - コンテキスト抽出
 * - タスク推奨
 * - 判断コーチング
 */

// 検索機能
export {
  searchForGPT,
  searchForGPTWithInference,
  type GPTSearchOptions,
  type GPTSearchResult,
  type GPTSearchWithInferenceResult,
} from "./search";

// コンテキスト抽出
export {
  getContextForGPT,
  type GPTContextOptions,
  type GPTContext,
} from "./context";

// タスク機能
export {
  prepareGPTTask,
  getNotesOverviewForGPT,
  generateTaskRecommendations,
  type GPTTaskType,
  type GPTTaskRequest,
  type GPTTaskResponse,
  type TaskPriority,
  type TaskCategory,
  type RecommendedTask,
  type TaskRecommendationResponse,
} from "./tasks";

// 判断コーチング
export {
  coachDecision,
  type CoachDecisionResponse,
} from "./coach";
