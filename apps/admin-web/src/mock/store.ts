import { buildSeed, type Db } from "./seed";

const STORAGE_KEY = "indus-erp-admin-web:db:v1";

function load(): Db {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    // fall through to reseed
  }
  const seeded = buildSeed();
  save(seeded);
  return seeded;
}

function save(db: Db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // localStorage unavailable (e.g. private mode) — mock still works in-memory for the session.
  }
}

let db: Db = load();

/** Read the current in-memory DB (never mutate the returned object directly — use mutate()). */
export function getDb(): Db {
  return db;
}

/** Apply a mutation to the DB and persist the result. */
export function mutate<T>(fn: (draft: Db) => T): T {
  const result = fn(db);
  save(db);
  return result;
}

/** Wipe all local demo data and reseed from scratch. */
export function resetDb(): Db {
  db = buildSeed();
  save(db);
  return db;
}
