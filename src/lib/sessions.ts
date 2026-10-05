import "server-only";
import crypto from "node:crypto";
import { db, now, tx } from "./db";
import type { Session } from "./types";

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 32자. 6자리면 약 10억 가지.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const DOWNLOAD_GRACE_MS = 7 * 24 * 3600 * 1000;

function randomCode(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

/** 한 번도 쓰인 적 없는 강의 코드. 만료된 세션 행도 남아 있으므로 재발급되지 않는다. */
export function issueSessionCode(): string {
  const exists = db().prepare("SELECT 1 FROM sessions WHERE code = ?");
  for (let i = 0; i < 20; i++) {
    const code = randomCode(6);
    if (!exists.get(code)) return code;
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
 * - 종료 후 7일이 지나면 만료: 참여자·결과물·기록 영구 삭제, 세션 행과 사용량은 정산용으로 남김
 */
export function refreshSession(sessionId: string): Session | null {
  const s = db().prepare("SELECT * FROM sessions WHERE id = ?").get(sessionId) as Session | undefined;
  if (!s) return null;
  const t = now();
  if (s.status === "active" && s.ends_at && s.ends_at <= t) {
    db().prepare("UPDATE sessions SET status = 'ended', ended_at = ? WHERE id = ?").run(s.ends_at, s.id);
    s.status = "ended";
    s.ended_at = s.ends_at;
  }
  if (s.status === "ended" && s.ended_at && s.ended_at + DOWNLOAD_GRACE_MS <= t) {
    expireSession(s.id);
    s.status = "expired";
  }
  return s;
}

export function expireSession(sessionId: string) {
  tx(() => {
    const conn = db();
    conn.prepare("DELETE FROM gallery WHERE session_id = ?").run(sessionId);
    conn.prepare("DELETE FROM versions WHERE session_id = ?").run(sessionId);
    conn.prepare("DELETE FROM participants WHERE session_id = ?").run(sessionId);
    conn.prepare("DELETE FROM logs WHERE session_id = ?").run(sessionId);
    conn
      .prepare("UPDATE sessions SET status = 'expired', spotlight_version_id = NULL, mission = '' WHERE id = ?")
      .run(sessionId);
  });
}

export function findSessionByCode(code: string): Session | null {
  const row = db().prepare("SELECT id FROM sessions WHERE code = ?").get(normalizeCode(code)) as
    | { id: string }
    | undefined;
  return row ? refreshSession(row.id) : null;
}

export function sessionCostUsd(sessionId: string): number {
  const row = db().prepare("SELECT COALESCE(SUM(cost_usd), 0) AS c FROM usage WHERE session_id = ?").get(sessionId) as {
    c: number;
  };
  return row.c;
}

export function addLog(sessionId: string, participantId: string | null, kind: string, text = "", warn = false) {
  db()
    .prepare("INSERT INTO logs (session_id, participant_id, kind, text, warn, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(sessionId, participantId, kind, text.slice(0, 500), warn ? 1 : 0, now());
}
