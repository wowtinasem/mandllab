import "server-only";
import { currentInstructor, currentParticipant } from "./auth";
import { db } from "./db";
import { refreshSession } from "./sessions";
import type { Version } from "./types";

/**
 * 버전을 읽을 수 있는 사람
 * - 만든 참여자 본인
 * - 같은 세션 참여자: 갤러리에 올라왔거나 강사가 스포트라이트한 버전
 * - 그 세션의 강사
 */
export async function readableVersion(versionId: string): Promise<{ version: Version; nickname: string } | null> {
  const row = await db()
    .prepare("SELECT v.*, p.nickname FROM versions v JOIN participants p ON p.id = v.participant_id WHERE v.id = ?")
    .get(versionId) as (Version & { nickname: string }) | undefined;
  if (!row) return null;
  const session = await refreshSession(row.session_id);
  if (!session || session.status === "expired") return null;
  const { nickname, ...version } = row;

  const me = await currentParticipant();
  if (me && me.session.id === row.session_id) {
    if (me.participant.id === row.participant_id) return { version, nickname };
    const shared =
      session.spotlight_version_id === row.id || await db().prepare("SELECT 1 FROM gallery WHERE version_id = ?").get(row.id);
    if (shared) return { version, nickname };
  }
  const inst = await currentInstructor();
  if (inst && (inst.id === session.instructor_id || inst.role === "admin")) return { version, nickname };
  return null;
}
