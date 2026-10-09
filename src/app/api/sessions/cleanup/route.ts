import { currentInstructor } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";
import { deleteSession, refreshSession } from "@/lib/sessions";

/**
 * 끝난 수업 한 번에 삭제.
 * 메인 관리자는 모든 강사의 끝난 수업을, 강사는 자기가 만든 끝난 수업만 지운다. 진행 중인 수업은 지우지 않는다.
 */
export async function POST() {
  const me = await currentInstructor();
  if (!me) return bad("로그인이 필요해요.", 401);
  const rows = (
    me.role === "admin"
      ? await db().prepare("SELECT id FROM sessions WHERE deleted_at IS NULL").all()
      : await db().prepare("SELECT id FROM sessions WHERE deleted_at IS NULL AND instructor_id = ?").all(me.id)
  ) as { id: string }[];
  let deleted = 0;
  for (const { id } of rows) {
    const s = await refreshSession(id); // 진행 시간이 지난 수업은 여기서 종료 상태로 바뀐다
    if (s && s.status !== "active") {
      await deleteSession(id);
      deleted++;
    }
  }
  return Response.json({ deleted });
}
