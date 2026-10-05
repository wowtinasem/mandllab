import { currentParticipant } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";
import { DOWNLOAD_GRACE_MS } from "@/lib/sessions";
import { isMockMode } from "@/lib/ai";

/** 참여자 화면이 몇 초마다 읽는 상태: 수업 상태, 미션, 남은 횟수, 내 버전 목록 */
export async function GET() {
  const me = await currentParticipant();
  if (!me) return bad("입장 정보가 없어요.", 401);
  const { participant: p, session: s } = me;
  const versions = db()
    .prepare("SELECT id, n, title, summary, prompt, created_at FROM versions WHERE participant_id = ? ORDER BY n")
    .all(p.id);
  const inGallery = db().prepare("SELECT version_id FROM gallery WHERE participant_id = ?").all(p.id) as { version_id: string }[];
  return Response.json({
    nickname: p.nickname,
    remaining: Math.max(0, s.per_limit - p.request_count),
    perLimit: s.per_limit,
    headVersionId: p.head_version_id,
    versions,
    galleryVersionIds: inGallery.map((g) => g.version_id),
    session: {
      title: s.title,
      code: s.code,
      status: s.status,
      paused: Boolean(s.paused),
      mission: s.mission,
      endsAt: s.ends_at,
      expiresAt: s.status === "ended" && s.ended_at ? s.ended_at + DOWNLOAD_GRACE_MS : null,
    },
    mockMode: isMockMode(),
  });
}
