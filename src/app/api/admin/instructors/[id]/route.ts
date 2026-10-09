import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, readJson } from "@/lib/http";

async function setInstructorStatus(instructorId: string, active: boolean) {
  await db()
    .prepare("UPDATE instructors SET status = ? WHERE id = ? AND role != 'admin'")
    .run(active ? "active" : "disabled", instructorId);
  // 중지하면 바로 로그아웃
  if (!active) await db().prepare("DELETE FROM instructor_tokens WHERE instructor_id = ?").run(instructorId);
}

/**
 * 메인 관리자: 허용 강사(또는 명단 없는 예전 계정) 사용 중지 / 다시 허용.
 * 중지하면 가입한 계정도 바로 로그아웃되고 로그인할 수 없다. 이미 만든 수업은 남는다.
 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/instructors/[id]">) {
  if (!(await currentAdmin())) return bad("메인 관리자만 바꿀 수 있어요.", 403);
  const { id } = await ctx.params;
  const b = await readJson<{ active: boolean }>(req);
  const active = Boolean(b.active);

  const allowed = (await db().prepare("SELECT instructor_id FROM allowed_instructors WHERE id = ?").get(id)) as
    | { instructor_id: string | null }
    | undefined;
  if (allowed) {
    await db().prepare("UPDATE allowed_instructors SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
    if (allowed.instructor_id) await setInstructorStatus(allowed.instructor_id, active);
    return Response.json({ ok: true });
  }
  const legacy = await db().prepare("SELECT 1 FROM instructors WHERE id = ? AND role != 'admin'").get(id);
  if (!legacy) return bad("강사를 찾을 수 없어요.", 404);
  await setInstructorStatus(id, active);
  return Response.json({ ok: true });
}

/** 메인 관리자: 아직 가입하지 않은 허용 강사를 명단에서 지운다. 가입한 강사는 지우지 않고 중지한다 */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/admin/instructors/[id]">) {
  if (!(await currentAdmin())) return bad("메인 관리자만 지울 수 있어요.", 403);
  const { id } = await ctx.params;
  const row = (await db().prepare("SELECT instructor_id FROM allowed_instructors WHERE id = ?").get(id)) as
    | { instructor_id: string | null }
    | undefined;
  if (!row) return bad("명단에서 찾을 수 없어요.", 404);
  if (row.instructor_id) return bad("이미 가입한 강사는 지울 수 없어요. 대신 '사용 중지'를 눌러 주세요.", 409);
  await db().prepare("DELETE FROM allowed_instructors WHERE id = ?").run(id);
  return Response.json({ ok: true });
}
