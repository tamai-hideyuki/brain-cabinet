import { Hono } from "hono";
import { searchNotes } from "../services/searchService";

export const searchRoute = new Hono();

searchRoute.get("", async (c) => {
  const query = c.req.query("query") || "";
  const results = await searchNotes(query);
  return c.json(results);
});
