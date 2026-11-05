import { ownedSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";
import { buildZip, contentDisposition, safeFileName, stampHtml } from "@/lib/download";
import type { Version } from "@/lib/types";

/** 강사·메인 관리자용: 이 수업의 모든 학생이 만든 최신 앱을 ZIP 하나로 (갤러리에 올리지 않은 앱 포함) */
export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]/apps-zip">) {
  const { id } = await ctx.params;
  const owned = await ownedSession(id);
  if (!owned) return bad("세션을 찾을 수 없어요.", 404);

  const rows = (await db()
    .prepare(
      `SELECT v.html, v.title, v.n, v.created_at, p.nickname FROM participants p
       JOIN versions v ON v.id = p.head_version_id
       WHERE p.session_id = ? ORDER BY p.created_at`,
    )
    .all(id)) as (Pick<Version, "html" | "title" | "n" | "created_at"> & { nickname: string })[];
  if (!rows.length) return bad("학생이 만든 앱이 없어요.", 404);

  const used = new Set<string>();
  const files = rows.map((r) => {
    let name = safeFileName(`${r.nickname} - ${r.title}`);
    for (let i = 2; used.has(name); i++) name = safeFileName(`${r.nickname} - ${r.title} (${i})`);
    used.add(name);
    return { name: `${name}.html`, content: stampHtml(r, r.nickname) };
  });
  return new Response(buildZip(files) as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": contentDisposition(`만들랩_학생앱전체_${owned.session.title}_${owned.session.code}.zip`),
    },
  });
}
