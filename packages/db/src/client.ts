import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "@indus/config";
import * as schema from "./schema.js";

// Managed Postgres (Render, RDS, etc.) requires SSL; local docker-compose
// Postgres doesn't support it. Skip SSL only for loopback hosts.
const isLocalHost = /^(localhost|127\.0\.0\.1)$/.test(new URL(config.DATABASE_URL).hostname);

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });
