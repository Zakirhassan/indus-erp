import { config as loadEnv } from "dotenv";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

loadEnv({ path: path.resolve(process.cwd(), "../../.env") });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://indus:indus_dev_password@localhost:5432/indus_erp",
  },
});
