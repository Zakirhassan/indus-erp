/**
 * @indus/config — typed, validated environment/config loading shared across
 * services/api and the apps. See /.env.example at the repo root for the
 * full list of config keys.
 */
import { config as loadEnv } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Resolve .env relative to this package's own location (not process.cwd()),
// since workspace scripts run with cwd set to the individual package dir
// (e.g. `npm run migrate -w @indus/db` has cwd packages/db, not repo root).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_ACCESS_SECRET: z.string().min(1, "JWT_ACCESS_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  AADHAAR_ENCRYPTION_KEY: z.string().optional(),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}\n\nSee .env.example at the repo root.`);
  }
  return parsed.data;
}

export const config = loadConfig();
export type Config = typeof config;
