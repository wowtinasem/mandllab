import { currentAdmin } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson, str } from "@/lib/http";
import { REVIEW_AFTER_MS, deleteSession } from "@/lib/sessions";

/**
 * 메인 관리자: 끝난 지 30일이 지나 삭제 여부를 정해야 하는 수업 목록.
 * 자동으로 지우지 않는다. 메인 관리자가 지우거나, 30일 뒤 다시 묻거나, 계속 보관을 고른다.
 */
export async function GET() {
  if (!(await currentAdmin())) return bad("메인 관리자만 볼 수 있어요.", 403);
  const t = now();
  // 진행 시간이 지났는데 아직 종료로 바뀌지 않은 수업을 먼저 정리한다
  await db().prepare("UPDATE sessions SET status = 'ended', ended_at = ends_at WHERE status = 'active' AND ends_at IS NOT NULL AND ends_at <= ?").run(t);
  const due = await db()
    .prepare(
      `SELECT s.id, s.code, s.title, s.ended_at, i.name AS instructor_name,
              (SELECT COUNT(*) FROM participants p WHERE p.session_id = s.id) AS participant_count,
              (SELECT COUNT(*) FROM versions v WHERE v.session_id = s.id) AS version_count
       FROM sessions s LEFT JOIN instructors i ON i.id = s.instructor_id
       WHERE s.status = 'ended' AND s.deleted_at IS NULL AND s.keep_forever = 0
         AND COALESCE(s.review_at, s.ended_at + ?) <= ?
       ORDER BY s.ended_at`,
    )
    .all(REVIEW_AFTER_MS, t);
  return Response.json({ due });
}

/**
 * 메인 관리자의 답
 * - delete: 지운다 (학생·결과물·기록 삭제, 목록에서 사라짐)
 * - later / seen: 30일 뒤 다시 묻는다 (팝업을 보고 답하지 않은 경우도 seen 으로 30일 미룬다)
 * - keep: 계속 보관하고 다시 묻지 않는다
 */
export async function POST(req: Request) {
  if (!(await currentAdmin())) return bad("메인 관리자만 정할 수 있어요.", 403);
  const b = await readJson<{ ids: string[]; action: "delete" | "later" | "seen" | "keep" }>(req);
  const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => str(x, 64)).filter(Boolean).slice(0, 200);
  if (!ids.length) return bad("수업을 골라 주세요.");
  const t = now();
  for (const id of ids) {
    if (b.action === "delete") await deleteSession(id);
    else if (b.action === "keep") await db().prepare("UPDATE sessions SET keep_forever = 1 WHERE id = ?").run(id);
    else if (b.action === "later" || b.action === "seen")
      await db().prepare("UPDATE sessions SET review_at = ? WHERE id = ?").run(t + REVIEW_AFTER_MS, id);
    else return bad("알 수 없는 선택이에요.");
  }
  return Response.json({ ok: true, count: ids.length });
}
