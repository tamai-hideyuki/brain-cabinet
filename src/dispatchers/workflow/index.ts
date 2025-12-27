/**
 * Workflow ドメイン ディスパッチャー
 *
 * ワークフロー実行と進捗状況の管理
 */

import {
  getWorkflowStatusResult,
  type WorkflowStatusResult,
} from "../../repositories/workflowStatusRepo";
import {
  insightDispatcher,
  type WorkflowReconstructResult,
} from "../insight";

export const workflowDispatcher = {
  /**
   * workflow.status - ワークフロー進捗状況を取得
   */
  async status(): Promise<WorkflowStatusResult> {
    return await getWorkflowStatusResult();
  },

  /**
   * workflow.reconstruct - フルリコンストラクト実行
   * （既存の insightDispatcher.reconstruct をラップ）
   */
  async reconstruct(): Promise<WorkflowReconstructResult> {
    return await insightDispatcher.reconstruct();
  },
};
