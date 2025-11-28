import { Hono } from "hono";
import { getAllNotes } from "../services/notesService";

export const notesRoute = new Hono();

notesRoute.get("/", async (c) => {
  const notes = await getAllNotes();
  return c.json(notes);
});
