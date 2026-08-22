#!/usr/bin/env node
/**
 * scripts/dev-up.mjs
 *
 * Cross-platform (Windows/macOS/Linux) "start everything" script for local
 * dev. Invoked via `npm run dev:up` from the repo root.
 *
 * Steps:
 *   1. Start Postgres via `docker compose up -d postgres`.
 *   2. Wait for it to report healthy (docker-compose.yml healthcheck).
 *   3. Run @indus/db migrations if a "migrate" script exists — no-op
 *      gracefully otherwise (Ada hasn't landed the db package yet).
 *   4. Run @indus/db seed if a "seed" script exists — same no-op tolerance.
 *   5. Start services/api and apps/admin-web dev servers concurrently, but
 *      only for whichever of them already has a "dev" script — skips
 *      gracefully (with a clear message) for the ones that are still
 *      placeholders.
 */

import { spawnSync, spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";

const POSTGRES_CONTAINER = "indus-erp-postgres";
const HEALTH_TIMEOUT_MS = 120_000;
const HEALTH_POLL_INTERVAL_MS = 2_000;

function log(msg) {
  console.log(`[dev:up] ${msg}`);
}

function warn(msg) {
  console.warn(`[dev:up] WARNING: ${msg}`);
}

function fail(msg) {
  console.error(`[dev:up] ERROR: ${msg}`);
  process.exit(1);
}

/** Run a command to completion, inheriting stdio. Returns the exit code. */
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: isWindows,
    cwd: repoRoot,
    ...options
  });
  if (result.error) {
    fail(`Failed to run "${command} ${args.join(" ")}": ${result.error.message}`);
  }
  return result.status ?? 1;
}

/** Run a command and capture stdout (no inherited stdio), never throws. */
function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
    cwd: repoRoot,
    ...options
  });
  return {
    status: result.status,
    stdout: (result.stdout ?? "").toString().trim(),
    stderr: (result.stderr ?? "").toString().trim()
  };
}

function readWorkspaceScripts(relativePkgJsonPath) {
  const fullPath = path.join(repoRoot, relativePkgJsonPath);
  if (!existsSync(fullPath)) return {};
  try {
    const pkg = JSON.parse(readFileSync(fullPath, "utf8"));
    return pkg.scripts ?? {};
  } catch {
    return {};
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  // --- 1. Docker present? ---
  log("Checking for Docker...");
  const dockerVersion = runCapture("docker", ["--version"]);
  if (dockerVersion.status !== 0) {
    fail(
      "Docker CLI not found on PATH. Install Docker Desktop and make sure it's " +
        "running, then re-run `npm run dev:up`."
    );
  }

  // --- 2. Start Postgres ---
  log("Starting Postgres (docker compose up -d postgres)...");
  const composeUp = run("docker", ["compose", "up", "-d", "postgres"]);
  if (composeUp !== 0) {
    fail(
      "`docker compose up -d postgres` failed. Is Docker Desktop running? " +
        "See docker-compose.yml at the repo root."
    );
  }

  // --- 3. Wait for health ---
  log(`Waiting for ${POSTGRES_CONTAINER} to become healthy...`);
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let healthy = false;
  while (Date.now() < deadline) {
    const inspect = runCapture("docker", [
      "inspect",
      "--format",
      "{{.State.Health.Status}}",
      POSTGRES_CONTAINER
    ]);
    const status = inspect.stdout.trim();
    if (status === "healthy") {
      healthy = true;
      break;
    }
    if (inspect.status !== 0) {
      warn(
        `Could not inspect container "${POSTGRES_CONTAINER}" yet (${inspect.stderr || "not found"}). Retrying...`
      );
    } else {
      log(`Postgres health status: ${status || "starting"} — waiting...`);
    }
    await sleep(HEALTH_POLL_INTERVAL_MS);
  }
  if (!healthy) {
    fail(
      `Postgres did not become healthy within ${HEALTH_TIMEOUT_MS / 1000}s. ` +
        `Check \`docker compose logs postgres\` and \`docker ps\`.`
    );
  }
  log("Postgres is healthy.");

  // --- 3b. Build packages/* that services/api and the db scripts resolve at
  // runtime via node_modules (not via tsconfig path aliases, which only cover
  // the editor/aggregate-typecheck experience) — shared-types, config, auth,
  // db, in that dependency order. Without this, `tsx src/migrate.ts`,
  // `tsx src/seed.ts`, and `tsx watch src/index.ts` (services/api) all fail to
  // resolve `@indus/*` imports.
  log("Building packages/{shared-types,config,auth,db} (needed for migrate/seed/api to resolve @indus/* at runtime)...");
  const packagesBuildStatus = run("npm", [
    "run",
    "build",
    "-w",
    "packages/shared-types",
    "-w",
    "packages/config",
    "-w",
    "packages/auth",
    "-w",
    "packages/db",
    "--if-present"
  ]);
  if (packagesBuildStatus !== 0) {
    fail("Building packages/{shared-types,config,auth,db} failed — see output above.");
  }

  // --- 4. Migrations (packages/db) ---
  const dbScripts = readWorkspaceScripts("packages/db/package.json");
  if (dbScripts.migrate) {
    log("Running @indus/db migrations (npm run migrate -w @indus/db)...");
    const migrateStatus = run("npm", ["run", "migrate", "-w", "@indus/db"]);
    if (migrateStatus !== 0) {
      fail("Migrations failed — see output above.");
    }
  } else {
    log('No "migrate" script found in packages/db yet — skipping migrations (nothing to do).');
  }

  // --- 5. Seed (packages/db) ---
  if (dbScripts.seed) {
    log("Running @indus/db seed (npm run seed -w @indus/db)...");
    const seedStatus = run("npm", ["run", "seed", "-w", "@indus/db"]);
    if (seedStatus !== 0) {
      fail("Seeding failed — see output above.");
    }
  } else {
    log('No "seed" script found in packages/db yet — skipping seed (nothing to do).');
  }

  // --- 6. Dev servers (services/api + apps/admin-web) ---
  const devTargets = [
    { name: "api", workspace: "@indus/api", scripts: readWorkspaceScripts("services/api/package.json") },
    {
      name: "admin-web",
      workspace: "@indus/admin-web",
      scripts: readWorkspaceScripts("apps/admin-web/package.json")
    }
  ];

  const runnable = devTargets.filter((t) => Boolean(t.scripts.dev));
  const notRunnable = devTargets.filter((t) => !t.scripts.dev);

  for (const t of notRunnable) {
    log(`No "dev" script found in ${t.workspace} yet — skipping (still a placeholder).`);
  }

  if (runnable.length === 0) {
    log(
      "No dev servers to start yet (services/api and apps/admin-web are still " +
        "placeholders). Postgres is up and ready at " +
        "postgresql://indus:indus_dev_password@localhost:5432/indus_erp — " +
        "nothing more to do for now."
    );
    return;
  }

  log(`Starting dev server(s): ${runnable.map((t) => t.workspace).join(", ")}`);
  const concurrentlyArgs = [
    "concurrently",
    "--kill-others-on-fail",
    "-n",
    runnable.map((t) => t.name).join(","),
    ...runnable.map((t) => `npm run dev -w ${t.workspace}`)
  ];
  const devStatus = run("npx", concurrentlyArgs);
  process.exit(devStatus);
}

main().catch((err) => {
  fail(err?.stack ?? String(err));
});
