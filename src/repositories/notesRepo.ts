import { db } from "../db/client";
import { notes } from "../db/schema";

export const findAllNotes = async () => {
  return await db.select().from(notes).all();
};
