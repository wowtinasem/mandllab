import "server-only";
import crypto from "node:crypto";
import { batch, db, now } from "./db";
import type { Session } from "./types";

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 32자. 6자리면 약 10억 가지.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/**
 * 학생 결과물은 자동으로 지우지 않는다. 수업이 끝나고 30일이 지나면 메인 관리자에게 삭제 여부를 묻고,
 * 답하지 않으면 30일 뒤 다시 묻는다. 지우는 것은 언제나 메인 관리자(또는 수업을 만든 강사)의 결정이다.
 */
export const REVIEW_AFTER_MS = 30 * 24 * 3600 * 1000;

/** 수업 한 번은 최대 4시간. 수업을 만든 시각부터 셈하며, 그 안에서는 강사가 자유롭게 진행·연장한다 */
export const MAX_CLASS_MIN = 240;
export const classDeadline = (createdAt: number) => createdAt + MAX_CLASS_MIN * 60_000;

function randomCode(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** 한 번도 쓰인 적 없는 강의 코드. 만료된 세션 행도 남아 있으므로 재발급되지 않는다. */
export async function issueSessionCode(): Promise<string> {
  const exists = db().prepare("SELECT 1 FROM sessions WHERE code = ?");
  for (let i = 0; i < 20; i++) {
    const code = randomCode(6);
    if (!await exists.get(code)) return code;
  }
  throw new Error("코드 발급 실패");
}

export function issueRecoveryCode(): string {
  return `${randomCode(4)}-${randomCode(4)}`;
}

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * 시간에 따른 상태 전환을 반영한 세션을 돌려준다.
 * - 진행 중인데 예정 종료 시각이 지났으면 종료
 * 끝난 수업의 결과물은 메인 관리자가 지우기 전까지 그대로 둔다 (자동 삭제 없음)
 */
export async function refreshSession(sessionId: string): Promise<Session | null> {
  const s = await db().prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as Session | undefined;
  if (!s) return null;
  const t = now();
  if (s.status === "active" && s.ends_at && s.ends_at <= t) {
    await db().prepare("UPDATE sessions SET status = 'ended', ended_at = ? WHERE id = ?").run(s.ends_at, s.id);
    s.status = "ended";
    s.ended_at = s.ends_at;
  }
  return s;
}

export async function expireSession(sessionId: string) {
  await batch([
    { sql: "DELETE FROM gallery WHERE session_id = ?", args: [sessionId] },
    { sql: "DELETE FROM versions WHERE session_id = ?", args: [sessionId] },
    { sql: "DELETE FROM participants WHERE session_id = ?", args: [sessionId] },
    { sql: "DELETE FROM logs WHERE session_id = ?", args: [sessionId] },
    { sql: "UPDATE sessions SET status = 'expired', spotlight_version_id = NULL, mission = '' WHERE id = ?", args: [sessionId] },
  ]);
}

/** 수업 삭제: 학생·결과물·기록을 지우고 목록에서도 숨긴다. 같은 코드가 다시 발급되지 않도록 행과 사용량은 남긴다 */
export async function deleteSession(sessionId: string) {
  await expireSession(sessionId);
  await db().prepare("UPDATE sessions SET deleted_at = ? WHERE id = ?").run(now(), sessionId);
}

export async function findSessionByCode(code: string): Promise<Session | null> {
  const row = await db().prepare("SELECT id FROM sessions WHERE code = ?").get(normalizeCode(code)) as
    | { id: string }
    | undefined;
  return row ? await refreshSession(row.id) : null;
}

export async function sessionCostUsd(sessionId: string): Promise<number> {
  const row = await db().prepare("SELECT COALESCE(SUM(cost_usd), 0) AS c FROM usage WHERE session_id = ?").get(sessionId) as {
    c: number;
  };
  return row.c;
}

export async function addLog(sessionId: string, participantId: string | null, kind: string, text = "", warn = false) {
  await db()
    .prepare("INSERT INTO logs (session_id, participant_id, kind, text, warn, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(sessionId, participantId, kind, text.slice(0, 500), warn ? 1 : 0, now());
}
