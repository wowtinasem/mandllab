import { currentInstructor, newId } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, clampInt, readJson, str } from "@/lib/http";
import { issueSessionCode, refreshSession } from "@/lib/sessions";

export async function GET() {
  const me = await currentInstructor();
  if (!me) return bad("로그인이 필요해요.", 401);
  const ids = db().prepare("SELECT id FROM sessions WHERE instructor_id = ? ORDER BY created_at DESC LIMIT 100").all(me.id) as {
    id: string;
  }[];
  const count = db().prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?");
  const cost = db().prepare("SELECT COALESCE(SUM(cost_usd),0) AS c FROM usage WHERE session_id = ?");
  const sessions = ids
    .map(({ id }) => refreshSession(id)!)
    .map((s) => ({
      ...s,
      participantCount: (count.get(s.id) as { n: number }).n,
      costUsd: (cost.get(s.id) as { c: number }).c,
    }));
  return Response.json({ sessions });
}

export async function POST(req: Request) {
  const me = await currentInstructor();
  if (!me) return bad("로그인이 필요해요.", 401);
  const b = await readJson<{ title: string; perLimit: number; costCapUsd: number; capacity: number; durationMin: number }>(req);
  const title = str(b.title, 60);
  if (!title) return bad("수업 이름을 입력해 주세요.");
  const perLimit = clampInt(b.perLimit, 1, 500, 30);
  const capacity = clampInt(b.capacity, 1, 300, 45);
  const durationMin = clampInt(b.durationMin, 0, 24 * 60, 180);
  const costCap = Math.min(1000, Math.max(0.1, Number(b.costCapUsd) || 50));

  const id = newId();
  const code = issueSessionCode();
  const t = now();
  db()
    .prepare(
      `INSERT INTO sessions (id, code, title, instructor_id, status, per_limit, cost_cap_usd, capacity, ends_at, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    )
    .run(id, code, title, me.id, perLimit, costCap, capacity, durationMin ? t + durationMin * 60_000 : null, t);
  return Response.json({ id, code });
}
