import { currentInstructor, newId } from "@/lib/auth";
import { db, isEphemeralDb, now } from "@/lib/db";
import { bad, clampInt, readJson, str } from "@/lib/http";
import { issueSessionCode, refreshSession } from "@/lib/sessions";

export async function GET() {
  const me = await currentInstructor();
  if (!me) return bad("로그인이 필요해요.", 401);
  // 메인 관리자는 모든 강사의 수업을, 강사는 자기가 만든 수업만 본다
  const ids = (
    me.role === "admin"
      ? await db().prepare("SELECT id FROM sessions ORDER BY created_at DESC LIMIT 300").all()
      : await db().prepare("SELECT id FROM sessions WHERE instructor_id = ? ORDER BY created_at DESC LIMIT 100").all(me.id)
  ) as { id: string }[];
  const names = new Map(
    ((await db().prepare("SELECT id, name FROM instructors").all()) as { id: string; name: string }[]).map((r) => [r.id, r.name]),
  );
  const count = db().prepare("SELECT COUNT(*) AS n FROM participants WHERE session_id = ?");
  const cost = db().prepare("SELECT COALESCE(SUM(cost_usd),0) AS c FROM usage WHERE session_id = ?");
  const sessions = await Promise.all(
    ids.map(async ({ id }) => {
      const s = (await refreshSession(id))!;
      return {
        ...s,
        participantCount: ((await count.get(s.id)) as { n: number }).n,
        costUsd: ((await cost.get(s.id)) as { c: number }).c,
        instructorName: names.get(s.instructor_id) ?? "",
        mine: s.instructor_id === me.id,
      };
    }),
  );
  return Response.json({ sessions });
}

export async function POST(req: Request) {
  const me = await currentInstructor();
  if (!me) return bad("로그인이 필요해요.", 401);
  if (isEphemeralDb())
    return bad("데이터베이스(Turso)가 아직 연결되지 않아 수업을 만들 수 없어요. 연결 전에는 수업이 사라지고 입장이 실패해요.", 503);
  const b = await readJson<{ title: string; perLimit: number; costCapUsd: number; capacity: number; durationMin: number }>(req);
  const title = str(b.title, 60);
  if (!title) return bad("수업 이름을 입력해 주세요.");
  const perLimit = clampInt(b.perLimit, 1, 500, 30);
  const capacity = clampInt(b.capacity, 1, 300, 45);
  const durationMin = clampInt(b.durationMin, 0, 24 * 60, 180);
  const costCap = Math.min(1000, Math.max(0.1, Number(b.costCapUsd) || 50));

  const id = newId();
  const code = await issueSessionCode();
  const t = now();
  await db()
    .prepare(
      `INSERT INTO sessions (id, code, title, instructor_id, status, per_limit, cost_cap_usd, capacity, ends_at, created_at)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    )
    .run(id, code, title, me.id, perLimit, costCap, capacity, durationMin ? t + durationMin * 60_000 : null, t);
  return Response.json({ id, code });
}
