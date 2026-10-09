import { currentInstructor, joinRateLimited, newId, recordFailedAttempt } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson, str } from "@/lib/http";

/**
 * 로그인한 강사(메인 관리자 포함) 화면이 15초마다 부른다.
 * - 아직 확인하지 않은 메시지를 돌려주고 (답장이면 원래 메시지도 함께)
 * - 이 사람이 지금 접속 중이라는 표시(last_seen)를 남긴다
 */
export async function GET() {
  const me = await currentInstructor();
  if (!me) return bad("로그인이 필요해요.", 401);
  await db().prepare("UPDATE instructors SET last_seen = ? WHERE id = ?").run(now(), me.id);
  const messages = await db()
    .prepare(
      `SELECT m.id, m.text, m.created_at, m.from_id, f.name AS from_name, f.role AS from_role, o.text AS reply_to_text
       FROM admin_messages m
       LEFT JOIN instructors f ON f.id = m.from_id
       LEFT JOIN admin_messages o ON o.id = m.reply_to
       WHERE m.to_id = ? AND m.read_at IS NULL ORDER BY m.created_at`,
    )
    .all(me.id);
  return Response.json({ messages });
}

/**
 * 메시지 보내기
 * - replyTo 가 있으면: 나에게 온 그 메시지를 보낸 사람에게 답장 (강사 ↔ 메인 관리자 모두)
 * - 없으면: 강사가 메인 관리자에게 새 메시지 (사용 중인 메인 관리자 모두에게)
 */
export async function POST(req: Request) {
  const me = await currentInstructor();
  if (!me) return bad("로그인이 필요해요.", 401);
  const key = `msg:${me.id}`;
  if (joinRateLimited(key)) return bad("메시지를 너무 자주 보냈어요. 1분 뒤 다시 보내 주세요.", 429);

  const b = await readJson<{ text: string; replyTo: string }>(req);
  const text = str(b.text, 500);
  if (!text) return bad("메시지 내용을 입력해 주세요.");

  let to: string[] = [];
  let replyTo: string | null = null;
  if (b.replyTo) {
    const orig = (await db()
      .prepare("SELECT id, from_id FROM admin_messages WHERE id = ? AND to_id = ?")
      .get(str(b.replyTo, 64), me.id)) as { id: string; from_id: string } | undefined;
    if (!orig) return bad("답장할 메시지를 찾을 수 없어요.", 404);
    replyTo = orig.id;
    to = [orig.from_id];
  } else {
    if (me.role === "admin") return bad("강사에게 새 메모는 강사 관리 탭에서 보내 주세요.");
    to = ((await db().prepare("SELECT id FROM instructors WHERE role = 'admin' AND status = 'active'").all()) as { id: string }[]).map(
      (r) => r.id,
    );
    if (!to.length) return bad("메시지를 받을 메인 관리자가 없어요.", 404);
  }

  const batchId = newId();
  const t = now();
  for (const id of to) {
    await db()
      .prepare("INSERT INTO admin_messages (id, batch_id, from_id, to_id, text, created_at, reply_to) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(newId(), batchId, me.id, id, text, t, replyTo);
  }
  // 너무 자주 보내지 않도록 보낸 횟수를 센다 (1분에 15번까지)
  recordFailedAttempt(key);
  return Response.json({ ok: true });
}

/** 확인했습니다: 본인에게 온 메시지만 읽음 처리 */
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
