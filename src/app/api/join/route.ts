import { clientIp, joinRateLimited, newId, recordFailedAttempt, randomToken, setParticipantCookie, sha256 } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson, str } from "@/lib/http";
import { addLog, findSessionByCode, issueRecoveryCode, normalizeCode } from "@/lib/sessions";

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (joinRateLimited(ip)) return bad("입장 시도가 너무 많아요. 1분 뒤 다시 시도해 주세요.", 429);
  const b = await readJson<{ code: string; nickname: string; agree: boolean }>(req);

  const session = findSessionByCode(str(b.code, 20));
  if (!session || session.status === "expired") {
    recordFailedAttempt(ip);
    return bad("강의 코드를 다시 확인해 주세요.", 404);
  }
  if (session.status === "ended") return bad("이미 끝난 수업이에요. 전에 받은 복귀 코드로 들어오면 결과물을 내려받을 수 있어요.", 403);
  if (session.locked) return bad("강사가 입장을 잠가 두었어요. 강사에게 알려 주세요.", 423);
  if (b.agree !== true) return bad("만 18세 이상 확인과 이용약관 동의가 필요해요.");

  const base = str(b.nickname, 20).replace(/[<>]/g, "");
  if (!base) return bad("이름이나 별명을 입력해 주세요.");

  const conn = db();
  const { n } = conn.prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?").get(session.id) as { n: number };
  if (n >= session.capacity) return bad("정원이 다 찼어요. 강사에게 알려 주세요.", 409);

  // 같은 별명이 있으면 (2), (3)… 을 붙인다
  const taken = conn.prepare("SELECT 1 FROM participants WHERE session_id = ? AND nickname = ?");
  let nickname = base;
  for (let i = 2; taken.get(session.id, nickname); i++) nickname = `${base}(${i})`;

  const recoveryCode = issueRecoveryCode();
  const token = randomToken();
  const id = newId();
  const t = now();
  conn
    .prepare(
      `INSERT INTO participants (id, session_id, nickname, recovery_hash, token_hash, adult_terms_at, last_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, session.id, nickname, sha256(`${session.id}:${normalizeCode(recoveryCode)}`), sha256(token), t, t, t);
  addLog(session.id, id, "join", nickname);
  await setParticipantCookie(token);
  return Response.json({ nickname, recoveryCode, sessionCode: session.code });
}
