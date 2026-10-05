import { currentParticipant, newId } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson, str } from "@/lib/http";
import { addLog } from "@/lib/sessions";
import { extractTitle } from "@/lib/ai";

const MAX_HTML = 1_500_000;

/** 코드 탭에서 직접 고친 코드를 새 버전으로 저장 (AI 요청 횟수 차감 없음) */
export async function POST(req: Request) {
  const me = await currentParticipant();
  if (!me) return bad("다시 입장해 주세요.", 401);
  const { participant, session } = me;
  if (session.status !== "active") return bad("수업이 끝나서 더 고칠 수 없어요.", 403);

  const b = await readJson<{ html: string; summary: string }>(req);
  const html = String(b.html ?? "");
  if (!html.trim()) return bad("코드가 비어 있어요.");
  if (html.length > MAX_HTML) return bad("코드가 너무 길어요.");

  const n = participant.version_count + 1;
  const id = newId();
  const title = extractTitle(html);
  const summary = str(b.summary, 200) || "코드를 직접 고쳤어요.";
  db()
    .prepare("INSERT INTO versions (id, participant_id, session_id, n, html, title, summary, prompt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, '', ?)")
    .run(id, participant.id, session.id, n, html, title, summary, now());
  db()
    .prepare("UPDATE participants SET version_count = ?, head_version_id = ?, app_title = ?, last_active = ? WHERE id = ?")
    .run(n, id, title, now(), participant.id);
  addLog(session.id, participant.id, "manual", summary);
  return Response.json({ id, n, title, summary, prompt: "", created_at: now() });
}
