import { currentInstructor } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson } from "@/lib/http";

/**
 * 강사 화면이 15초마다 부른다.
 * - 아직 확인하지 않은 메인 관리자 메모를 돌려주고
 * - 이 강사가 지금 접속 중이라는 표시(last_seen)를 남긴다
 */
export async function GET() {
  const me = await currentInstructor();
  if (!me) return bad("로그인이 필요해요.", 401);
  await db().prepare("UPDATE instructors SET last_seen = ? WHERE id = ?").run(now(), me.id);
  const messages = await db()
    .prepare(
      `SELECT m.id, m.text, m.created_at, f.name AS from_name FROM admin_messages m
       LEFT JOIN instructors f ON f.id = m.from_id
       WHERE m.to_id = ? AND m.read_at IS NULL ORDER BY m.created_at`,
    )
    .all(me.id);
  return Response.json({ messages });
}

/** 확인했습니다: 본인에게 온 메모만 읽음 처리 */
export async function PATCH(req: Request) {
  const me = await currentInstructor();
  if (!me) return bad("로그인이 필요해요.", 401);
  const b = await readJson<{ ids: string[] }>(req);
  const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).slice(0, 50);
  for (const id of ids) {
    await db().prepare("UPDATE admin_messages SET read_at = ? WHERE id = ? AND to_id = ? AND read_at IS NULL").run(now(), id, me.id);
  }
  return Response.json({ ok: true });
}
