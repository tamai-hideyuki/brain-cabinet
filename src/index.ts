import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { notesRoute } from "./routes/notes";
import { searchRoute } from "./routes/search";
import { gptRoute } from "./routes/gpt";

const app = new Hono();

app.route("/api/notes", notesRoute);
app.route("/api/search", searchRoute);
app.route("/api/gpt", gptRoute);

app.get("/", (c) => c.text("brain-cabinet API running"));

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`Server running on http://localhost:${info.port}`);
});
