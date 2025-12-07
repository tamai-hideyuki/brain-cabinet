/**
 * Insight ドメイン ディスパッチャー
 */

import * as ptmEngine from "../services/ptm/engine";

export const insightDispatcher = {
  async lite() {
    return ptmEngine.generateMetaStateLite();
  },

  async full() {
    return ptmEngine.generateMetaStateFull();
  },

  async coach() {
    const lite = await ptmEngine.generateMetaStateLite();
    return {
      date: lite.date,
      coach: lite.coach,
    };
  },

  // workflow.reconstruct 用（将来実装）
  async reconstruct() {
    // TODO: ワークフロー再構築ロジックを実装
    return {
      message: "Workflow reconstruction not yet implemented",
      status: "pending",
    };
  },
};
