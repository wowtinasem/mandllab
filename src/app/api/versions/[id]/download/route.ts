import { readableVersion } from "@/lib/access";
import { bad } from "@/lib/http";
import { contentDisposition, safeFileName, stampHtml } from "@/lib/download";

/** 단일 HTML 파일 다운로드. 파일 이름은 앱 제목, 첫머리에 만든 도구·버전·날짜 주석 */
export async function GET(_req: Request, ctx: RouteContext<"/api/versions/[id]/download">) {
  const { id } = await ctx.params;
  const found = await readableVersion(id);
  if (!found) return bad("결과물을 찾을 수 없어요.", 404);
  const { version } = found;
  return new Response(stampHtml(version), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-disposition": contentDisposition(`${safeFileName(version.title)} v${version.n}.html`),
      "cache-control": "no-store",
    },
  });
}
