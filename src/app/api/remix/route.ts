import { currentParticipant, newId } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson, str } from "@/lib/http";
import { addLog } from "@/lib/sessions";
import type { Version } from "@/lib/types";

/** 갤러리의 다른 사람 앱을 내 새 버전으로 복사해서 이어 만든다 */
export async function POST(req: Request) {
  const me = await currentParticipant();
  if (!me) return bad("다시 입장해 주세요.", 401);
  const { participant, session } = me;
  if (session.status !== "active") return bad("수업이 끝나서 리믹스할 수 없어요.", 403);

  const b = await readJson<{ galleryId: string }>(req);
  const src = db()
    .prepare(
      `SELECT v.html, v.title, p.nickname FROM gallery g JOIN versions v ON v.id = g.version_id
       JOIN participants p ON p.id = g.participant_id WHERE g.id = ? AND g.session_id = ?`,
    )
    .get(str(b.galleryId, 64), session.id) as (Pick<Version, "html" | "title"> & { nickname: string }) | undefined;
  if (!src) return bad("갤러리 항목을 찾을 수 없어요.", 404);

  const n = participant.version_count + 1;
  const id = newId();
  const summary = `${src.nickname}님의 '${src.title}'을 가져와 리믹스를 시작했어요.`;
  db()
    .prepare("INSERT INTO versions (id, participant_id, session_id, n, html, title, summary, prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, '', ?)")
    .run(id, participant.id, session.id, n, src.html, src.title, summary, now());
  db()
    .prepare("UPDATE participants SET version_count = ?, head_version_id = ?, app_title = ?, last_active = ? WHERE id = ?")
    .run(n, id, src.title, now(), participant.id);
  addLog(session.id, participant.id, "remix", `${src.nickname} · ${src.title}`);
  return Response.json({ id, n, title: src.title, summary, prompt: "", created_at: now() });
}
