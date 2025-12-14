import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

const client = createClient({ url: "file:./data.db" });

// WALモードを有効化（同時アクセス時のロック競合を軽減）
client.execute("PRAGMA journal_mode = WAL;");
client.execute("PRAGMA busy_timeout = 5000;");

// パフォーマンス最適化
client.execute("PRAGMA cache_size = -64000;");   // 64MB キャッシュ（デフォルト2MB）
client.execute("PRAGMA mmap_size = 268435456;"); // 256MB メモリマップI/O
client.execute("PRAGMA temp_store = MEMORY;");   // 一時テーブルをメモリに配置

export const db = drizzle(client);
