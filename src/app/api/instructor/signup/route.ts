import { db, now } from "@/lib/db";
import { clientIp, hashPassword, joinRateLimited, newId, recordFailedAttempt, startInstructorSession } from "@/lib/auth";
import { bad, readJson, str } from "@/lib/http";
import { consumeAccessCode } from "@/lib/accessCodes";

/** 강사 가입: 메인 관리자가 발급한 강사 접근 코드가 있어야 한다 */
export async function POST(req: Request) {
  const key = `signup:${clientIp(req)}`;
  if (joinRateLimited(key)) return bad("시도가 너무 많아요. 1분 뒤 다시 시도해 주세요.", 429);
  const b = await readJson<{ email: string; name: string; org: string; password: string; accessCode: string }>(req);

  const email = str(b.email, 120).toLowerCase();
  const name = str(b.name, 40);
  const org = str(b.org, 60);
  const password = String(b.password ?? "");
  if (!str(b.accessCode)) return bad("관리자에게 받은 강사 접근 코드를 입력해 주세요.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("이메일 형식을 확인해 주세요.");
  if (!name) return bad("이름을 입력해 주세요.");
  if (password.length < 8) return bad("비밀번호는 8자 이상이어야 해요.");
  if (await db().prepare("SELECT 1 FROM instructors WHERE email = ?").get(email)) return bad("이미 가입한 이메일이에요.", 409);

  const used = await consumeAccessCode(str(b.accessCode, 30));
  if ("error" in used) {
    recordFailedAttempt(key);
    return bad(used.error, 403);
  }

  const id = newId();
  await db()
    .prepare(
      `INSERT INTO instructors (id, email, name, org, pw_hash, created_at, role, status, access_code_id)
       VALUES (?, ?, ?, ?, ?, ?, 'instructor', 'active', ?)`,
    )
    .run(id, email, name, org, hashPassword(password), now(), used.id);
  await startInstructorSession(id);
  return Response.json({ ok: true });
}
