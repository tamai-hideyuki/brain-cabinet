import { Hono } from "hono";
import { searchNotes } from "../services/searchService";

export const searchRoute = new Hono();

searchRoute.get("/", async (c) => {
  let q = c.req.query("query") || "";

  //日本語やemoji検索のため
  q = decodeURIComponent(q);

  const results = await searchNotes(q);
  return c.json(results);
});
