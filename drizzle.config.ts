import type { Config } from "drizzle-kit";

export default {
  dialect: "sqlite",
  schema: "./src/shared/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: "./data.db",
  },
} satisfies Config;
