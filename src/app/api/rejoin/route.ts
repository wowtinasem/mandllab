import { clientIp, joinRateLimited, randomToken, recordFailedAttempt, setParticipantCookie, sha256 } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson, str } from "@/lib/http";
import { findSessionByCode, normalizeCode } from "@/lib/sessions";

/** 다른 기기나 브라우저에서 강의 코드 + 개인 복귀 코드로 내 작업을 다시 연다 */
export async function POST(req: Request) {
  const ip = clientIp(req);
  if (joinRateLimited(ip)) return bad("시도가 너무 많아요. 1분 뒤 다시 시도해 주세요.", 429);
  const b = await readJson<{ code: string; recoveryCode: string }>(req);
  const session = findSessionByCode(str(b.code, 20));
  if (!session || session.status === "expired") {
    recordFailedAttempt(ip);
    return bad("강의 코드를 다시 확인해 주세요.", 404);
  }

  const row = db()
    .prepare("SELECT id, nickname FROM participants WHERE session_id = ? AND recovery_hash = ?")
    .get(session.id, sha256(`${session.id}:${normalizeCode(str(b.recoveryCode, 20))}`)) as { id: string; nickname: string } | undefined;
  if (!row) {
    recordFailedAttempt(ip);
    return bad("복귀 코드가 맞지 않아요.", 404);
  }

  // 새 기기로 들어오면 이전 기기의 접속은 끊긴다
  const token = randomToken();
  db().prepare("UPDATE participants SET token_hash = ?, last_active = ? WHERE id = ?").run(sha256(token), now(), row.id);
  await setParticipantCookie(token);
  return Response.json({ nickname: row.nickname });
}
