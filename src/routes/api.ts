/**
 * APIルート一括登録
 *
 * /api/* 配下の全ルートをまとめて管理
 */
import { Hono } from "hono";
import { notesRoute } from "../modules/note";
import { searchRoute } from "../modules/search";
import { gptRoute } from "../modules/gpt";
import { clustersRoute, clusterDynamicsRoute, clusterEvolutionRoute } from "../modules/cluster";
import { analyticsRoute } from "../modules/analytics";
import { driftRoute } from "../modules/drift";
import { influenceRoute } from "../modules/influence";
import { ptmRoute } from "../modules/ptm";
import { insightRoute } from "../modules/insight";
import { commandRoute } from "../modules/command";
import { bookmarksRoute } from "../modules/bookmark";
import { secretBoxRoute } from "../modules/secret-box";
import { systemRoute } from "../modules/system";
import { thinkingReportRoute } from "../modules/thinking-report";
import { pomodoroRoute } from "../modules/pomodoro";

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
apiRoutes.route("/pomodoro", pomodoroRoute);
