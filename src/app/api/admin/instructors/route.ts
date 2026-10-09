import { currentAdmin, newId } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson, str } from "@/lib/http";
import { formatPhone, normalizePhone } from "@/lib/phone";

/**
 * 메인 관리자: 허용 강사 명단 + 가입 상태 + 수업 수.
 * 명단 없이 예전에 가입한 강사 계정(legacy)도 함께 보여 준다.
 */
export async function GET() {
  if (!(await currentAdmin())) return bad("메인 관리자만 볼 수 있어요.", 403);
  const allowed = await db()
    .prepare(
      `SELECT a.id, a.name, a.phone, a.org, a.memo, a.active, a.created_at, a.instructor_id,
              i.email, i.created_at AS joined_at,
              (SELECT COUNT(*) FROM sessions s WHERE s.instructor_id = a.instructor_id) AS session_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.instructor_id = a.instructor_id AND s.status = 'active') AS active_count
       FROM allowed_instructors a LEFT JOIN instructors i ON i.id = a.instructor_id
       ORDER BY a.created_at DESC`,
    )
    .all();
  const legacy = await db()
    .prepare(
      `SELECT i.id, i.name, i.email, i.org, i.status, i.created_at,
              (SELECT COUNT(*) FROM sessions s WHERE s.instructor_id = i.id) AS session_count
       FROM instructors i
       WHERE i.role != 'admin' AND NOT EXISTS (SELECT 1 FROM allowed_instructors a WHERE a.instructor_id = i.id)
       ORDER BY i.created_at DESC`,
    )
    .all();
  return Response.json({
    allowed: (allowed as { phone: string }[]).map((a) => ({ ...a, phoneText: formatPhone(a.phone) })),
    legacy,
  });
}

/**
 * 메인 관리자: 허용 강사 등록. 한 명 또는 여러 명을 한 번에.
 * body: { items: [{ name, phone, org?, memo? }] }
 */
export async function POST(req: Request) {
  if (!(await currentAdmin())) return bad("메인 관리자만 등록할 수 있어요.", 403);
  const b = await readJson<{ items: { name?: string; phone?: string; org?: string; memo?: string }[] }>(req);
  const items = Array.isArray(b.items) ? b.items.slice(0, 200) : [];
  if (!items.length) return bad("등록할 강사를 입력해 주세요.");

  const added: string[] = [];
  const failed: { line: string; reason: string }[] = [];
  for (const it of items) {
    const name = str(it.name, 40);
    const phone = normalizePhone(str(it.phone, 30));
    const line = `${name || "(이름 없음)"} ${str(it.phone, 30)}`.trim();
    if (!name) {
      failed.push({ line, reason: "이름이 없어요" });
      continue;
    }
    if (!phone) {
      failed.push({ line, reason: "전화번호 형식이 아니에요" });
      continue;
    }
    if (await db().prepare("SELECT 1 FROM allowed_instructors WHERE phone = ?").get(phone)) {
      failed.push({ line, reason: "이미 등록된 전화번호예요" });
      continue;
    }
    await db()
      .prepare("INSERT INTO allowed_instructors (id, name, phone, org, memo, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(newId(), name, phone, str(it.org, 60), str(it.memo, 100), now());
    added.push(name);
  }
  return Response.json({ added, failed });
}
