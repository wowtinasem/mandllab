import { readableVersion } from "@/lib/access";
import { bad } from "@/lib/http";

export async function GET(_req: Request, ctx: RouteContext<"/api/versions/[id]">) {
  const { id } = await ctx.params;
  const found = await readableVersion(id);
  if (!found) return bad("결과물을 찾을 수 없어요.", 404);
  return Response.json({ ...found.version, nickname: found.nickname });
}
