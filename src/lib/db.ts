import "server-only";
import { createClient, type Client, type InArgs } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "./password";

// 로컬 개발: data/mandllab.db 파일. 배포(Vercel): Turso (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
// 연결이 요청마다 달라질 수 있으므로 FK 연쇄 삭제에 기대지 않고 지울 때는 테이블마다 명시적으로 지운다.
const SCHEMA = `
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

type Arg = string | number | null;

const g = globalThis as unknown as { __mandllabDb?: { client: Client; ready: Promise<void> } };

function conn() {
  if (!g.__mandllabDb) {
    const url = process.env.TURSO_DATABASE_URL || process.env.LIBSQL_URL;
    let client: Client;
    if (url) {
      client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN || process.env.LIBSQL_AUTH_TOKEN });
    } else {
      // Vercel 은 /tmp 만 쓸 수 있다. Turso 연결 전 임시 실행용이며 데이터가 언제든 사라질 수 있다.
      const fallback = process.env.VERCEL ? "/tmp/mandllab.db" : path.join(process.cwd(), "data", "mandllab.db");
      if (process.env.VERCEL) console.warn("[db] TURSO_DATABASE_URL 이 없어 임시 저장소(/tmp)를 씁니다. 데이터가 유지되지 않습니다.");
      const file = process.env.DATABASE_PATH || fallback;
      fs.mkdirSync(path.dirname(file), { recursive: true });
      client = createClient({ url: `file:${file}` });
    }
    const ready = client.executeMultiple(SCHEMA).then(() => seedAdmin(client));
    g.__mandllabDb = { client, ready };
    ready.catch(() => {
      g.__mandllabDb = undefined; // 다음 요청에서 다시 시도
    });
  }
  return g.__mandllabDb;
}

// 관리자 테스트 계정: ADMIN_TEST_PASSWORD 가 있으면 아이디 'admin' 으로 강사 화면에 로그인할 수 있다.
// 비밀번호는 코드에 두지 않고 환경 변수로만 받으며, 바꾸면 다음 서버 시작 때 반영된다.
export const ADMIN_LOGIN_ID = "admin";

async function seedAdmin(client: Client) {
  const pw = process.env.ADMIN_TEST_PASSWORD;
  if (!pw) return;
  await client.execute({
    sql: `INSERT INTO instructors (id, email, name, org, pw_hash, created_at) VALUES ('admin-test', ?, '관리자(테스트)', '만들랩', ?, ?)
          ON CONFLICT(email) DO UPDATE SET pw_hash = excluded.pw_hash`,
    args: [ADMIN_LOGIN_ID, hashPassword(pw), Date.now()],
  });
}

async function exec(sql: string, args: Arg[]) {
  const c = conn();
  await c.ready;
  return c.client.execute({ sql, args: args as InArgs });
}

/** node:sqlite 와 비슷한 모양의 비동기 문장 */
export function db() {
  return {
    prepare(sql: string) {
      return {
        async get(...args: Arg[]): Promise<unknown> {
          const rs = await exec(sql, args);
          return rs.rows[0] ? Object.fromEntries(rs.columns.map((col, i) => [col, rs.rows[0][i]])) : undefined;
        },
        async all(...args: Arg[]): Promise<unknown[]> {
          const rs = await exec(sql, args);
          return rs.rows.map((row) => Object.fromEntries(rs.columns.map((col, i) => [col, row[i]])));
        },
        async run(...args: Arg[]) {
          const rs = await exec(sql, args);
          return { changes: rs.rowsAffected };
        },
      };
    },
  };
}

/** 여러 쓰기를 한 트랜잭션으로 */
export async function batch(statements: { sql: string; args?: Arg[] }[]) {
  const c = conn();
  await c.ready;
  await c.client.batch(
    statements.map((st) => ({ sql: st.sql, args: (st.args ?? []) as InArgs })),
    "write",
  );
}

export const now = () => Date.now();
