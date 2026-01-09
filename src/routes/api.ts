/**
 * APIルート一括登録
 *
 * /api/* 配下の全ルートをまとめて管理
 */
import { Hono } from "hono";
import { notesRoute } from "./notes/index";
import { searchRoute } from "./search/index";
import { gptRoute } from "./gpt/index";
import { clustersRoute } from "./clusters/index";
import { analyticsRoute } from "./analytics/index";
import { driftRoute } from "./drift/index";
import { influenceRoute } from "./influence/index";
import { clusterDynamicsRoute } from "./cluster-dynamics/index";
import { clusterEvolutionRoute } from "./cluster-evolution/index";
import { ptmRoute } from "./ptm/index";
import { insightRoute } from "./insight/index";
import commandRoute from "./command/index";
import { bookmarksRoute } from "./bookmarks/index";
import { secretBoxRoute } from "./secret-box/index";
import { systemRoute } from "./system/index";
import { thinkingReportRoute } from "./thinking-report/index";

export const apiRoutes = new Hono();

apiRoutes.route("/notes", notesRoute);
apiRoutes.route("/search", searchRoute);
apiRoutes.route("/gpt", gptRoute);
apiRoutes.route("/clusters", clustersRoute);
apiRoutes.route("/analytics", analyticsRoute);
apiRoutes.route("/drift", driftRoute);
apiRoutes.route("/influence", influenceRoute);
apiRoutes.route("/cluster-dynamics", clusterDynamicsRoute);
apiRoutes.route("/cluster-evolution", clusterEvolutionRoute);
apiRoutes.route("/ptm", ptmRoute);
apiRoutes.route("/insight", insightRoute);
apiRoutes.route("/v1", commandRoute);
apiRoutes.route("/bookmarks", bookmarksRoute);
apiRoutes.route("/secret-box", secretBoxRoute);
apiRoutes.route("/system", systemRoute);
apiRoutes.route("/thinking-report", thinkingReportRoute);
