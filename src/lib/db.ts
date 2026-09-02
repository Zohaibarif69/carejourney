/**
 * Database — Turso (cloud SQLite via @libsql/client).
 *
 * Replaces better-sqlite3 so the app works on Vercel serverless.
 * Set these env vars in Vercel dashboard:
 *   TURSO_DATABASE_URL=libsql://your-db.turso.io
 *   TURSO_AUTH_TOKEN=your-token-here
 *
 * Locally you can use a file URL instead:
 *   TURSO_DATABASE_URL=file:./carejourney.db
 *   TURSO_AUTH_TOKEN=   (leave empty for local file)
 */

import { createClient, type Client, type ResultSet } from "@libsql/client";

let _client: Client | null = null;
let _migrated = false;

export function getDb(): Client {
  if (_client) return _client;
  _client = createClient({
    url: process.env.TURSO_DATABASE_URL ?? "file:./carejourney.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  return _client;
}

// ─── Migration ───────────────────────────────────────────────────────────────

export async function ensureSchema(): Promise<void> {
  if (_migrated) return;
  const db = getDb();

  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      serpapi_place_id TEXT UNIQUE,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      specialties TEXT NOT NULL DEFAULT '[]',
      services TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      website TEXT NOT NULL DEFAULT '',
      image_url TEXT NOT NULL DEFAULT '',
      rating REAL,
      review_count INTEGER,
      match_reasons TEXT NOT NULL DEFAULT '[]',
      match_strength TEXT NOT NULL DEFAULT 'Possible',
      last_synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journeys (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      provider_city TEXT NOT NULL,
      provider_country TEXT NOT NULL,
      service TEXT NOT NULL,
      patient TEXT NOT NULL DEFAULT '{}',
      visual_session TEXT,
      consultation_answers TEXT,
      consultation_schema TEXT,
      signed INTEGER NOT NULL DEFAULT 0,
      signed_at TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      doctavian_envelope_id TEXT
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      file_name TEXT,
      file_url TEXT,
      status TEXT NOT NULL DEFAULT 'waiting',
      foxit_job_id TEXT,
      extracted_text TEXT,
      processing_step INTEGER NOT NULL DEFAULT 0,
      redactions TEXT,
      sealed INTEGER NOT NULL DEFAULT 0,
      sealed_at TEXT,
      seal_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'requested',
      submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS agent_classifications (
      id TEXT PRIMARY KEY,
      journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
      raw_prompt TEXT NOT NULL,
      llm_output TEXT NOT NULL DEFAULT '[]',
      confirmed INTEGER NOT NULL DEFAULT 0,
      confirmed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  _migrated = true;
}

// ─── Query helpers (thin wrappers matching the old better-sqlite3 API) ────────

/** Run a SELECT and return all rows as plain objects. */
export async function dbAll(
  sql: string,
  args: (string | number | null | boolean)[] = []
): Promise<Record<string, unknown>[]> {
  await ensureSchema();
  const result: ResultSet = await getDb().execute({ sql, args });
  return result.rows as unknown as Record<string, unknown>[];
}

/** Run a SELECT and return the first row, or undefined. */
export async function dbGet(
  sql: string,
  args: (string | number | null | boolean)[] = []
): Promise<Record<string, unknown> | undefined> {
  const rows = await dbAll(sql, args);
  return rows[0];
}

/** Run an INSERT / UPDATE / DELETE. */
export async function dbRun(
  sql: string,
  args: (string | number | null | boolean)[] = []
): Promise<void> {
  await ensureSchema();
  await getDb().execute({ sql, args });
}

// ─── JSON helpers ─────────────────────────────────────────────────────────────

export function parseJson<T>(val: unknown, fallback: T): T {
  if (!val) return fallback;
  try {
    return JSON.parse(val as string) as T;
  } catch {
    return fallback;
  }
}

export function toJson(val: unknown): string {
  return JSON.stringify(val ?? null);
}

// ─── UUID ─────────────────────────────────────────────────────────────────────

export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
