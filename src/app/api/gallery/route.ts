import { currentParticipant, newId } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson, str } from "@/lib/http";
import { addLog } from "@/lib/sessions";
import type { Version } from "@/lib/types";

/** 같은 수업의 갤러리 목록 */
export async function GET() {
  const me = await currentParticipant();
  if (!me) return bad("다시 입장해 주세요.", 401);
  const items = db()
    .prepare(
      `SELECT g.id, g.title, g.version_id, g.created_at, p.nickname, (g.participant_id = ?) AS mine
       FROM gallery g JOIN participants p ON p.id = g.participant_id
       WHERE g.session_id = ? ORDER BY g.created_at DESC`,
    )
    .all(me.participant.id, me.session.id);
  return Response.json({ items, spotlightVersionId: me.session.spotlight_version_id });
}

/** 내 버전을 갤러리에 올린다. 한 사람당 최신 1개만 유지 */
export async function POST(req: Request) {
  const me = await currentParticipant();
  if (!me) return bad("다시 입장해 주세요.", 401);
  const b = await readJson<{ versionId: string }>(req);
  const v = db()
    .prepare("SELECT id, title FROM versions WHERE id = ? AND participant_id = ?")
    .get(str(b.versionId, 64), me.participant.id) as Pick<Version, "id" | "title"> | undefined;
  if (!v) return bad("올릴 결과물을 찾을 수 없어요.", 404);

  db().prepare("DELETE FROM gallery WHERE participant_id = ?").run(me.participant.id);
  db()
    .prepare("INSERT INTO gallery (id, session_id, participant_id, version_id, title, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(newId(), me.session.id, me.participant.id, v.id, v.title, now());
  addLog(me.session.id, me.participant.id, "gallery", v.title);
  return Response.json({ ok: true });
}
