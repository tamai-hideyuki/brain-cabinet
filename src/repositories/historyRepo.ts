import { db } from "../db/client";
import { noteHistory } from "../db/schema";

export const insertHistory = async (data: any) => {
  return await db.insert(noteHistory).values(data);
};
