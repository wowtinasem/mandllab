import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, readJson } from "@/lib/http";

/** 메인 관리자: 강사 사용 중지 / 다시 허용. 중지하면 바로 로그아웃되고 수업을 만들 수 없다 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/instructors/[id]">) {
  const admin = await currentAdmin();
  if (!admin) return bad("메인 관리자만 바꿀 수 있어요.", 403);
  const { id } = await ctx.params;
  if (id === admin.id) return bad("내 계정은 중지할 수 없어요.");
  const b = await readJson<{ active: boolean }>(req);
  const r = await db()
    .prepare("UPDATE instructors SET status = ? WHERE id = ? AND role != 'admin'")
    .run(b.active ? "active" : "disabled", id);
  if (!r.changes) return bad("강사를 찾을 수 없어요.", 404);
  if (!b.active) await db().prepare("DELETE FROM instructor_tokens WHERE instructor_id = ?").run(id);
  return Response.json({ ok: true });
}
