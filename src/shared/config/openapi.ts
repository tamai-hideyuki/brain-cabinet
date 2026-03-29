/**
 * OpenAPI仕様読み込み
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const openapi = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../openapi.json"), "utf8")
);
