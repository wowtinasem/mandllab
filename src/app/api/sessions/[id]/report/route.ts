import { ownedSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";
import { contentDisposition } from "@/lib/download";

const KRW = Number(process.env.KRW_PER_USD) || 1400;

/** 고객사 정산용 사용량 보고서 (CSV, 엑셀에서 바로 열림) */
export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]/report">) {
  const { id } = await ctx.params;
  const owned = await ownedSession(id);
  if (!owned) return bad("세션을 찾을 수 없어요.", 404);
  const { session, instructor } = owned;

  const rows = db()
    .prepare(
      `SELECT COALESCE(p.nickname, '(삭제된 참여자)') AS nickname, u.model,
              COUNT(*) AS calls, SUM(u.input_tokens) AS input, SUM(u.output_tokens) AS output, SUM(u.cost_usd) AS cost
       FROM usage u LEFT JOIN participants p ON p.id = u.participant_id
       WHERE u.session_id = ? GROUP BY u.participant_id, u.model ORDER BY nickname`,
    )
    .all(id) as { nickname: string; model: string; calls: number; input: number; output: number; cost: number }[];

  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const fmtDate = (t: number | null) => (t ? new Date(t).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "");
  const total = rows.reduce((a, r) => ({ calls: a.calls + r.calls, input: a.input + r.input, output: a.output + r.output, cost: a.cost + r.cost }), {
    calls: 0,
    input: 0,
    output: 0,
    cost: 0,
  });

  const lines = [
    ["수업", session.title],
    ["강의 코드", session.code],
    ["강사", `${instructor.name} (${instructor.org || "소속 없음"})`],
    ["생성 시각", fmtDate(session.created_at)],
    ["종료 시각", fmtDate(session.ended_at)],
    ["비용 상한(USD)", session.cost_cap_usd],
    ["환율(원/USD)", KRW],
    [],
    ["참여자", "모델", "AI 호출 수", "입력 토큰", "출력 토큰", "비용(USD)", "비용(원)"],
    ...rows.map((r) => [r.nickname, r.model, r.calls, r.input, r.output, r.cost.toFixed(4), Math.round(r.cost * KRW)]),
    [],
    ["합계", "", total.calls, total.input, total.output, total.cost.toFixed(4), Math.round(total.cost * KRW)],
  ];
  const csv = "﻿" + lines.map((l) => l.map(esc).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": contentDisposition(`만들랩_사용량_${session.title}_${session.code}.csv`),
    },
  });
}
