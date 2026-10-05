import { ownedSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";
import { buildZip, contentDisposition, safeFileName, stampHtml } from "@/lib/download";
import type { Version } from "@/lib/types";

/** 강사용: 세션 갤러리 결과물을 ZIP 하나로 (D6) */
export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]/gallery-zip">) {
  const { id } = await ctx.params;
  const owned = await ownedSession(id);
  if (!owned) return bad("세션을 찾을 수 없어요.", 404);

  const rows = db()
    .prepare(
      `SELECT v.html, v.title, v.n, v.created_at, p.nickname FROM gallery g
       JOIN versions v ON v.id = g.version_id JOIN participants p ON p.id = g.participant_id
       WHERE g.session_id = ? ORDER BY g.created_at`,
    )
    .all(id) as (Pick<Version, "html" | "title" | "n" | "created_at"> & { nickname: string })[];
  if (!rows.length) return bad("갤러리에 올라온 결과물이 없어요.", 404);

  const used = new Set<string>();
  const files = rows.map((r) => {
    let name = safeFileName(`${r.nickname} - ${r.title}`);
    for (let i = 2; used.has(name); i++) name = safeFileName(`${r.nickname} - ${r.title} (${i})`);
    used.add(name);
    return { name: `${name}.html`, content: stampHtml(r, r.nickname) };
  });
  const zip = buildZip(files);
  return new Response(zip as unknown as BodyInit, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": contentDisposition(`만들랩_갤러리_${owned.session.title}.zip`),
    },
  });
}
