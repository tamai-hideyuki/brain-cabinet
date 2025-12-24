import { Hono } from "hono";
import { crudRoute } from "./crud";
import { historyRoute } from "./history";

export const notesRoute = new Hono();

// CRUD操作
notesRoute.route("/", crudRoute);

// 履歴関連
notesRoute.route("/", historyRoute);
