import { currentAdmin, newId } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, clampInt, readJson, str } from "@/lib/http";
import { issueAccessCode } from "@/lib/accessCodes";

/** 메인 관리자: 발급한 강사 접근 코드 목록 (그 코드로 가입한 강사 이름 포함) */
export async function GET() {
  if (!(await currentAdmin())) return bad("메인 관리자만 볼 수 있어요.", 403);
  const codes = (await db().prepare("SELECT * FROM access_codes ORDER BY created_at DESC").all()) as {
    id: string;
    expires_at: number | null;
  }[];
  const t = now();
  const users = (await db()
    .prepare("SELECT access_code_id, name FROM instructors WHERE access_code_id IS NOT NULL ORDER BY created_at")
    .all()) as { access_code_id: string; name: string }[];
  return Response.json({
    codes: codes.map((c) => ({ ...c, expired: c.expires_at !== null && c.expires_at <= t, usedBy: users.filter((u) => u.access_code_id === c.id).map((u) => u.name) })),
  });
}

/** 메인 관리자: 새 강사 접근 코드 발급 */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return bad("메인 관리자만 발급할 수 있어요.", 403);
  const b = await readJson<{ label: string; maxUses: number; expiresDays: number }>(req);
  const maxUses = clampInt(b.maxUses, 1, 500, 1);
  const days = clampInt(b.expiresDays, 0, 365, 30);
  const code = await issueAccessCode();
  const id = newId();
  await db()
    .prepare("INSERT INTO access_codes (id, code, label, max_uses, expires_at, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(id, code, str(b.label, 60), maxUses, days ? now() + days * 86_400_000 : null, admin.id, now());
  return Response.json({ id, code });
}
