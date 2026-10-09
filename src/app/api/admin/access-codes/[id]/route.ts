import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad, readJson } from "@/lib/http";

/** 메인 관리자: 접근 코드 사용 중지 / 다시 사용. 이미 가입한 강사에게는 영향이 없다 */
export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/access-codes/[id]">) {
  if (!(await currentAdmin())) return bad("메인 관리자만 바꿀 수 있어요.", 403);
  const { id } = await ctx.params;
  const b = await readJson<{ active: boolean }>(req);
  const r = await db().prepare("UPDATE access_codes SET active = ? WHERE id = ?").run(b.active ? 1 : 0, id);
  if (!r.changes) return bad("접근 코드를 찾을 수 없어요.", 404);
  return Response.json({ ok: true });
}
