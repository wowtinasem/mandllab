import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db, now } from "./db";
import type { Instructor, Participant, Session } from "./types";
import { refreshSession } from "./sessions";
export { hashPassword, verifyPassword } from "./password";

export const INSTRUCTOR_COOKIE = "ml_inst";
export const PARTICIPANT_COOKIE = "ml_part";

const INSTRUCTOR_TTL_MS = 30 * 24 * 3600 * 1000;

export const newId = () => crypto.randomUUID();
export const randomToken = () => crypto.randomBytes(32).toString("base64url");
export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function startInstructorSession(instructorId: string) {
  const token = randomToken();
  await db()
    .prepare("INSERT INTO instructor_tokens (token_hash, instructor_id, expires_at) VALUES (?, ?, ?)")
    .run(sha256(token), instructorId, now() + INSTRUCTOR_TTL_MS);
  (await cookies()).set(INSTRUCTOR_COOKIE, token, { ...cookieBase, maxAge: INSTRUCTOR_TTL_MS / 1000 });
}

export async function endInstructorSession() {
  const store = await cookies();
  const token = store.get(INSTRUCTOR_COOKIE)?.value;
  if (token) await db().prepare("DELETE FROM instructor_tokens WHERE token_hash = ?").run(sha256(token));
  store.delete(INSTRUCTOR_COOKIE);
}

export async function currentInstructor(): Promise<Instructor | null> {
  const token = (await cookies()).get(INSTRUCTOR_COOKIE)?.value;
  if (!token) return null;
  const row = await db()
    .prepare(
      `SELECT i.id, i.email, i.name, i.org, i.role FROM instructor_tokens t
       JOIN instructors i ON i.id = t.instructor_id
       WHERE t.token_hash = ? AND t.expires_at > ? AND i.status = 'active'`,
    )
    .get(sha256(token), now()) as Instructor | undefined;
  return row ?? null;
}

export const isAdmin = (i: Instructor | null) => i?.role === "admin";

/** 강사는 자기가 만든 세션만, 메인 관리자는 모든 세션을 돌려준다. 볼 수 없으면 null. */
export async function ownedSession(sessionId: string): Promise<{ instructor: Instructor; session: Session } | null> {
  const instructor = await currentInstructor();
  if (!instructor) return null;
  const session = await refreshSession(sessionId);
  if (!session || (session.instructor_id !== instructor.id && !isAdmin(instructor))) return null;
  return { instructor, session };
}

/** 메인 관리자만 통과. 아니면 null */
export async function currentAdmin(): Promise<Instructor | null> {
  const i = await currentInstructor();
  return isAdmin(i) ? i : null;
}

export async function setParticipantCookie(token: string) {
  (await cookies()).set(PARTICIPANT_COOKIE, token, { ...cookieBase, maxAge: 14 * 24 * 3600 });
}

export async function currentParticipant(): Promise<{ participant: Participant; session: Session } | null> {
  const token = (await cookies()).get(PARTICIPANT_COOKIE)?.value;
  if (!token) return null;
  const participant = await db().prepare("SELECT * FROM participants WHERE token_hash = ?").get(sha256(token)) as
    | Participant
    | undefined;
  if (!participant) return null;
  const session = await refreshSession(participant.session_id);
  if (!session || session.status === "expired") return null;
  return { participant, session };
}

// 코드 맞히기 방지: 틀린 시도만 센다. 한 강의실 40명이 같은 회사망 IP로 들어와도 막히지 않게
const FAIL_LIMIT_PER_MIN = 15;
const g = globalThis as unknown as { __mlFailHits?: Map<string, number[]> };
const failHits = () => (g.__mlFailHits ??= new Map<string, number[]>());

export function joinRateLimited(key: string): boolean {
  const t = now();
  const recent = (failHits().get(key) ?? []).filter((x: number) => t - x < 60_000);
  failHits().set(key, recent);
  return recent.length >= FAIL_LIMIT_PER_MIN;
}

export function recordFailedAttempt(key: string) {
  const list = failHits().get(key) ?? [];
  list.push(now());
  failHits().set(key, list);
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}
