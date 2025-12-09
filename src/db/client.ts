import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

const client = createClient({ url: "file:./data.db" });

// WALモードを有効化（同時アクセス時のロック競合を軽減）
client.execute("PRAGMA journal_mode = WAL;");
client.execute("PRAGMA busy_timeout = 5000;");

export const db = drizzle(client);
