import { db, now } from "@/lib/db";
import { clientIp, joinRateLimited, newId, recordFailedAttempt, startInstructorSession } from "@/lib/auth";
import { bad, readJson, str } from "@/lib/http";
import { normalizeName, normalizePhone } from "@/lib/phone";
import type { AllowedInstructor } from "@/lib/types";

/**
 * 강사 가입: 메인 관리자가 미리 등록한 허용 강사 명단의 이름·전화번호와 맞아야 한다.
 * 명단에 없는 사람의 가입은 받지 않는다.
 */
export async function POST(req: Request) {
  const key = `signup:${clientIp(req)}`;
  if (joinRateLimited(key)) return bad("시도가 너무 많아요. 1분 뒤 다시 시도해 주세요.", 429);
  const b = await readJson<{ name: string; phone: string; email: string }>(req);

  const name = str(b.name, 40);
  const phone = normalizePhone(str(b.phone, 30));
  const email = str(b.email, 120).toLowerCase();
  if (!name) return bad("강사 이름을 입력해 주세요.");
  if (!phone) return bad("전화번호를 확인해 주세요. 예: 010-1234-5678");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("이메일 형식을 확인해 주세요.");

  const allowed = (await db().prepare("SELECT * FROM allowed_instructors WHERE phone = ?").get(phone)) as AllowedInstructor | undefined;
  if (!allowed || normalizeName(allowed.name) !== normalizeName(name)) {
    recordFailedAttempt(key);
    return bad("등록된 강사 정보와 일치하지 않아요. 이름과 전화번호를 확인하거나 메인 관리자에게 문의해 주세요.", 403);
  }
  if (!allowed.active) return bad("사용이 중지된 강사예요. 메인 관리자에게 문의해 주세요.", 403);
  if (allowed.instructor_id) return bad("이미 가입을 마쳤어요. 강사 로그인에서 이름과 전화번호로 들어오세요.", 409);
  if (await db().prepare("SELECT 1 FROM instructors WHERE email = ?").get(email)) return bad("이미 다른 강사가 쓰는 이메일이에요.", 409);

  const id = newId();
  // 비밀번호 없이 이름+전화번호로 로그인하므로 pw_hash 는 비워 둔다 (비밀번호 로그인은 메인 관리자만)
  await db()
    .prepare(
      `INSERT INTO instructors (id, email, name, org, pw_hash, created_at, role, status, phone)
       VALUES (?, ?, ?, ?, '', ?, 'instructor', 'active', ?)`,
    )
    .run(id, email, allowed.name, allowed.org, now(), phone);
  // 동시에 두 번 눌러도 명단 한 줄에는 계정 하나만 연결된다
  const linked = await db()
    .prepare("UPDATE allowed_instructors SET instructor_id = ? WHERE id = ? AND instructor_id IS NULL")
    .run(id, allowed.id);
  if (linked.changes !== 1) {
    await db().prepare("DELETE FROM instructors WHERE id = ?").run(id);
    return bad("이미 가입을 마쳤어요. 강사 로그인에서 이름과 전화번호로 들어오세요.", 409);
  }
  await startInstructorSession(id);
  return Response.json({ ok: true });
}
