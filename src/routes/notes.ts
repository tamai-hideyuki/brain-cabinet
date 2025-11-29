import { Hono } from "hono";
import { getAllNotes } from "../services/notesService";
import { updateNote } from "../services/notesService";

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
