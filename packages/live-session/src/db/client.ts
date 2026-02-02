import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const defaultDbPath = join(__dirname, "../../data/live-session.db");

const client = createClient({
  url: process.env.LIVE_SESSION_DATABASE_URL || `file:${defaultDbPath}`,
});

export const db = drizzle(client, { schema });
