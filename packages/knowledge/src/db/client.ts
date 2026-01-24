import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultDbPath = join(__dirname, "../../data/knowledge.db");

const client = createClient({
  url: process.env.KNOWLEDGE_DATABASE_URL || `file:${defaultDbPath}`,
});

export const db = drizzle(client, { schema });
