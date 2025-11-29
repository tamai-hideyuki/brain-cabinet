import { Hono } from "hono";
import { getAllNotes, updateNote } from "../services/notesService";
import { getNoteHistory } from "../services/historyService";

export const notesRoute = new Hono();

notesRoute.get("/", async (c) => {
  const notes = await getAllNotes();
  return c.json(notes);
});

notesRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const { content } = await c.req.json();

  const updated = await updateNote(id, content);
  return c.json(updated);
});

notesRoute.get("/:id/history", async (c) => {
  const id = c.req.param("id");
  const history = await getNoteHistory(id);
  return c.json(history);
});
