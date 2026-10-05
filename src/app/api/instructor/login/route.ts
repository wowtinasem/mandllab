import { db } from "@/lib/db";
import { clientIp, joinRateLimited, recordFailedAttempt, startInstructorSession, verifyPassword } from "@/lib/auth";
import { bad, readJson, str } from "@/lib/http";

export async function POST(req: Request) {
  const key = `login:${clientIp(req)}`;
  if (joinRateLimited(key)) return bad("시도가 너무 많아요. 1분 뒤 다시 시도해 주세요.", 429);
  const b = await readJson<{ email: string; password: string }>(req);
  const row = db().prepare("SELECT id, pw_hash FROM instructors WHERE email = ?").get(str(b.email, 120).toLowerCase()) as
    | { id: string; pw_hash: string }
    | undefined;
  if (!row || !verifyPassword(String(b.password ?? ""), row.pw_hash)) {
    recordFailedAttempt(key);
    return bad("이메일 또는 비밀번호가 맞지 않아요.", 401);
  }
  await startInstructorSession(row.id);
  return Response.json({ ok: true });
}
