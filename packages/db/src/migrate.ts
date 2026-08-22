import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  console.log("[migrate] Applying migrations from ./migrations...");
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../migrations") });
  console.log("[migrate] Done.");
  await pool.end();
}

main().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
