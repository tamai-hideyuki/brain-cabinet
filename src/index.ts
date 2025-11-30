import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { notesRoute } from "./routes/notes";
import { searchRoute } from "./routes/search";
import { gptRoute } from "./routes/gpt";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM 用の __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openapi = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../openapi.json"), "utf8")
);

const app = new Hono();

app.get("/openapi.json", (c) => c.json(openapi));
app.route("/api/notes", notesRoute);
app.route("/api/search", searchRoute);
app.route("/api/gpt", gptRoute);
app.get("/", (c) => c.text("brain-cabinet API running"));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
