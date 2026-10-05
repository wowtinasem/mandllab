import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS instructors (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  org TEXT NOT NULL DEFAULT '',
  pw_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS instructor_tokens (
  token_hash TEXT PRIMARY KEY,
  instructor_id TEXT NOT NULL REFERENCES instructors(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);

-- 세션 행은 만료 뒤에도 남겨서 같은 코드가 다시 발급되지 않게 한다
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  instructor_id TEXT NOT NULL REFERENCES instructors(id),
  status TEXT NOT NULL DEFAULT 'active',      -- active | ended | expired
  per_limit INTEGER NOT NULL,
  cost_cap_usd REAL NOT NULL,
  capacity INTEGER NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  paused INTEGER NOT NULL DEFAULT 0,
  mission TEXT NOT NULL DEFAULT '',
  spotlight_version_id TEXT,
  ends_at INTEGER,
  ended_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  recovery_hash TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  adult_terms_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  error_streak INTEGER NOT NULL DEFAULT 0,
  last_active INTEGER NOT NULL,
  app_title TEXT NOT NULL DEFAULT '',
  version_count INTEGER NOT NULL DEFAULT 0,
  head_version_id TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, nickname)
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  n INTEGER NOT NULL,
  html TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  prompt TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS versions_participant ON versions(participant_id, n);

CREATE TABLE IF NOT EXISTS gallery (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  version_id TEXT NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS gallery_session ON gallery(session_id, created_at);

CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  participant_id TEXT,
  kind TEXT NOT NULL,          -- join | create | edit | fix | explain | blocked | refused | error | gallery | remix | manual
  text TEXT NOT NULL DEFAULT '',
  warn INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS logs_session ON logs(session_id, id);

CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  participant_id TEXT,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS usage_session ON usage(session_id);
`;

const g = globalThis as unknown as { __mandllabDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__mandllabDb) {
    const file = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "mandllab.db");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const conn = new DatabaseSync(file);
    conn.exec(SCHEMA);
    g.__mandllabDb = conn;
  }
  return g.__mandllabDb;
}

export function tx<T>(fn: () => T): T {
  const conn = db();
  conn.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    conn.exec("COMMIT");
    return out;
  } catch (e) {
    conn.exec("ROLLBACK");
    throw e;
  }
}

export const now = () => Date.now();
