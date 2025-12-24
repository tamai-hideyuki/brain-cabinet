import { Hono } from "hono";
import { crudRoute } from "./crud";
import { historyRoute } from "./history";
import { imagesRoute, noteImagesRoute } from "./images";

export const notesRoute = new Hono();

// CRUD操作
notesRoute.route("/", crudRoute);

// 履歴関連
notesRoute.route("/", historyRoute);

// 画像関連
notesRoute.route("/images", imagesRoute);    // /api/notes/images/:id/data
notesRoute.route("/", noteImagesRoute);       // /api/notes/:noteId/images
