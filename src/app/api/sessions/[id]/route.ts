import { ownedSession } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, clampInt, readJson, str } from "@/lib/http";
import { addLog, classDeadline, deleteSession, refreshSession } from "@/lib/sessions";
import type { Participant } from "@/lib/types";

const STUCK_IDLE_MS = 5 * 60_000;

export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const owned = await ownedSession(id);
  if (!owned) return bad("세션을 찾을 수 없어요.", 404);
  const { session } = owned;
  const t = now();

  const participants = (
    await db().prepare("SELECT * FROM participants WHERE session_id = ? ORDER BY created_at").all(id) as unknown as Participant[]
  ).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    request_count: p.request_count,
    version_count: p.version_count,
    last_active: p.last_active,
    app_title: p.app_title,
    head_version_id: p.head_version_id,
    error_streak: p.error_streak,
    stuck:
      session.status === "active" &&
      (p.error_streak >= 2 || (t - p.last_active > STUCK_IDLE_MS && p.request_count < session.per_limit)),
  }));

  const logs = await db()
    .prepare(
      `SELECT l.id, l.kind, l.text, l.warn, l.created_at, p.nickname FROM logs l
       LEFT JOIN participants p ON p.id = l.participant_id
       WHERE l.session_id = ? ORDER BY l.id DESC LIMIT 60`,
    )
    .all(id);

  const gallery = await db()
    .prepare(
      `SELECT g.id, g.title, g.version_id, g.created_at, p.nickname FROM gallery g
       JOIN participants p ON p.id = g.participant_id
       WHERE g.session_id = ? ORDER BY g.created_at DESC`,
    )
    .all(id);

  const usage = await db()
    .prepare(
      `SELECT COUNT(*) AS calls, COALESCE(SUM(input_tokens),0) AS input, COALESCE(SUM(output_tokens),0) AS output,
              COALESCE(SUM(cost_usd),0) AS cost FROM usage WHERE session_id = ?`,
    )
    .get(id);

  return Response.json({
    session,
    participants,
    logs,
    gallery,
    usage,
    serverNow: t,
    expiresAt: null,
  });
}

type Action =
  | "end"
  | "resume"
  | "lock"
  | "unlock"
  | "pause"
  | "unpause"
  | "mission"
  | "spotlight"
  | "extend"
  | "settings"
  | "grant";

export async function PATCH(req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const owned = await ownedSession(id);
  if (!owned) return bad("세션을 찾을 수 없어요.", 404);
  const { session } = owned;
  if (session.status === "expired") return bad("만료된 세션이에요.", 410);

  const b = await readJson<{
    action: Action;
    mission: string;
    versionId: string | null;
    minutes: number;
    perLimit: number;
    costCapUsd: number;
    capacity: number;
    participantId: string;
    extra: number;
  }>(req);
  const conn = db();
  const t = now();
  const set = (sql: string, ...args: (string | number | null)[]) =>
    conn.prepare(`UPDATE sessions SET ${sql} WHERE id = ?`).run(...args, id);

  switch (b.action) {
    case "end":
      if (session.status === "active") await set("status = 'ended', ended_at = ?, paused = 0", t);
      break;
    case "resume":
      if (session.status === "ended") {
        // 예정 종료 시각이 지났으면 1시간 연장해서 다시 연다
        // 다시 열 때도 수업을 만든 뒤 4시간을 넘길 수 없다
        const deadline = classDeadline(session.created_at);
        if (deadline <= t) return bad("수업 시간(최대 4시간)이 지나서 다시 열 수 없어요. 학생은 결과물을 계속 내려받을 수 있어요.", 409);
        const endsAt = Math.min(session.ends_at && session.ends_at > t ? session.ends_at : t + 60 * 60_000, deadline);
        await set("status = 'active', ended_at = NULL, ends_at = ?, review_at = NULL", endsAt);
      }
      break;
    case "lock":
    case "unlock":
      await set("locked = ?", b.action === "lock" ? 1 : 0);
      break;
    case "pause":
    case "unpause":
      await set("paused = ?", b.action === "pause" ? 1 : 0);
      break;
    case "mission":
      await set("mission = ?", str(b.mission, 300));
      if (str(b.mission)) await addLog(id, null, "mission", str(b.mission, 300));
      break;
    case "spotlight": {
      const vid = b.versionId ? str(b.versionId, 64) : null;
      if (vid && !await conn.prepare("SELECT 1 FROM versions WHERE id = ? AND session_id = ?").get(vid, id)) return bad("결과물을 찾을 수 없어요.", 404);
      await set("spotlight_version_id = ?", vid);
      break;
    }
    case "extend": {
      const minutes = clampInt(b.minutes, 5, 600, 30);
      const deadline = classDeadline(session.created_at);
      const current = Math.max(session.ends_at ?? t, t);
      if (current >= deadline) return bad("이미 최대 수업 시간(4시간)까지 연장했어요.", 409);
      await set("ends_at = ?", Math.min(current + minutes * 60_000, deadline));
      break;
    }
    case "settings":
      await set(
        "per_limit = ?, cost_cap_usd = ?, capacity = ?",
        clampInt(b.perLimit, 1, 500, session.per_limit),
        Math.min(1000, Math.max(0.1, Number(b.costCapUsd) || session.cost_cap_usd)),
        clampInt(b.capacity, 1, 300, session.capacity),
      );
      break;
    case "grant": {
      // 특정 참여자에게 요청 횟수를 더 준다 (사용 횟수를 줄이는 방식)
      const extra = clampInt(b.extra, 1, 100, 5);
      conn
        .prepare("UPDATE participants SET request_count = MAX(0, request_count - ?) WHERE id = ? AND session_id = ?")
        .run(extra, str(b.participantId, 64), id);
      break;
    }
    default:
      return bad("알 수 없는 동작이에요.");
  }
  return Response.json({ session: await refreshSession(id) });
}

/** 세션 영구 삭제: 코드는 즉시 무효가 되고 결과물·기록이 지워진다. 사용량 기록은 정산용으로 남는다. */
export async function DELETE(_req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const owned = await ownedSession(id);
  if (!owned) return bad("세션을 찾을 수 없어요.", 404);
  await deleteSession(id);
  return Response.json({ ok: true });
}
