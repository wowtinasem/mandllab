import { db } from "@/lib/db";
import { clientIp, joinRateLimited, recordFailedAttempt, startInstructorSession, verifyPassword } from "@/lib/auth";
import { bad, readJson, str } from "@/lib/http";
import { PHONE_HINT, normalizeName, normalizePhone } from "@/lib/phone";

/**
 * 로그인 두 가지
 * - 강사: 이름 + 전화번호 (허용 강사 명단에 있고 가입을 마친 사람)
 * - 메인 관리자: 아이디 + 비밀번호
 */
export async function POST(req: Request) {
  const key = `login:${clientIp(req)}`;
  if (joinRateLimited(key)) return bad("시도가 너무 많아요. 1분 뒤 다시 시도해 주세요.", 429);
  const b = await readJson<{ name: string; phone: string; email: string; password: string }>(req);

  if (b.phone !== undefined) {
    const phone = normalizePhone(str(b.phone, 30));
    if (!phone) return bad(PHONE_HINT);
    const row = phone
      ? ((await db()
          .prepare(
            `SELECT i.id, i.name, i.status, a.active FROM instructors i
             JOIN allowed_instructors a ON a.instructor_id = i.id
             WHERE a.phone = ?`,
          )
          .get(phone)) as { id: string; name: string; status: string; active: number } | undefined)
      : undefined;
    if (!row || normalizeName(row.name) !== normalizeName(str(b.name, 40))) {
      recordFailedAttempt(key);
      const registered = phone && (await db().prepare("SELECT instructor_id FROM allowed_instructors WHERE phone = ?").get(phone));
      return bad(
        registered && !(registered as { instructor_id: string | null }).instructor_id
          ? "아직 가입하지 않았어요. 먼저 강사 가입을 해 주세요."
          : "이름 또는 전화번호가 맞지 않아요.",
        401,
      );
    }
    if (row.status !== "active" || !row.active) return bad("사용이 중지된 강사 계정이에요. 메인 관리자에게 문의해 주세요.", 403);
    await startInstructorSession(row.id);
    return Response.json({ ok: true });
  }

  // 메인 관리자 로그인 (비밀번호 로그인은 메인 관리자만)
  const row = (await db()
    .prepare("SELECT id, pw_hash, status, role FROM instructors WHERE email = ?")
    .get(str(b.email, 120).toLowerCase())) as { id: string; pw_hash: string; status: string; role: string } | undefined;
  if (!row || row.role !== "admin" || !row.pw_hash || !verifyPassword(String(b.password ?? ""), row.pw_hash)) {
    recordFailedAttempt(key);
    return bad("아이디 또는 비밀번호가 맞지 않아요.", 401);
  }
  if (row.status !== "active") return bad("사용이 중지된 계정이에요.", 403);
  await startInstructorSession(row.id);
  return Response.json({ ok: true });
}
