import { currentAdmin, newId } from "@/lib/auth";
import { db, now } from "@/lib/db";
import { bad, readJson, str } from "@/lib/http";
import { ONLINE_WINDOW_MS, type MessageTarget } from "@/lib/messages";

const TARGETS: MessageTarget[] = ["one", "online", "teaching", "all"];

/** 메인 관리자: 최근 보낸 메모와 확인한 인원 */
export async function GET() {
  if (!(await currentAdmin())) return bad("메인 관리자만 볼 수 있어요.", 403);
  const rows = (await db()
    .prepare(
      `SELECT m.batch_id, m.text, m.created_at, m.read_at, i.name AS to_name
       FROM admin_messages m LEFT JOIN instructors i ON i.id = m.to_id
       WHERE m.created_at > ? ORDER BY m.created_at DESC LIMIT 300`,
    )
    .all(now() - 14 * 86_400_000)) as { batch_id: string; text: string; created_at: number; read_at: number | null; to_name: string }[];
  const batches = new Map<string, { id: string; text: string; created_at: number; to: { name: string; read: boolean }[] }>();
  for (const r of rows) {
    const b = batches.get(r.batch_id) ?? { id: r.batch_id, text: r.text, created_at: r.created_at, to: [] };
    b.to.push({ name: r.to_name ?? "(삭제된 강사)", read: r.read_at !== null });
    batches.set(r.batch_id, b);
  }
  return Response.json({ sent: [...batches.values()].slice(0, 20) });
}

/**
 * 메인 관리자: 강사에게 메모 보내기
 * target: one(한 명) | online(지금 접속 중) | teaching(진행 중인 수업이 있는) | all(사용 중인 모든 강사)
 */
export async function POST(req: Request) {
  const admin = await currentAdmin();
  if (!admin) return bad("메인 관리자만 보낼 수 있어요.", 403);
  const b = await readJson<{ target: MessageTarget; instructorId: string; text: string }>(req);
  const text = str(b.text, 500);
  const target = TARGETS.includes(b.target as MessageTarget) ? (b.target as MessageTarget) : null;
  if (!text) return bad("메모 내용을 입력해 주세요.");
  if (!target) return bad("받는 사람을 골라 주세요.");

  const base = "SELECT i.id, i.name FROM instructors i WHERE i.status = 'active' AND i.id != ?";
  const t = now();
  const recipients = (
    target === "one"
      ? await db().prepare(`${base} AND i.id = ?`).all(admin.id, str(b.instructorId, 64))
      : target === "online"
        ? await db().prepare(`${base} AND i.last_seen > ?`).all(admin.id, t - ONLINE_WINDOW_MS)
        : target === "teaching"
          ? await db()
              .prepare(`${base} AND EXISTS (SELECT 1 FROM sessions s WHERE s.instructor_id = i.id AND s.status = 'active')`)
              .all(admin.id)
          : await db().prepare(base).all(admin.id)
  ) as { id: string; name: string }[];
  if (!recipients.length) {
    const why = { one: "그 강사에게 보낼 수 없어요 (가입 전이거나 중지됨).", online: "지금 접속 중인 강사가 없어요.", teaching: "지금 수업 중인 강사가 없어요.", all: "메모를 받을 강사가 없어요." }[target];
    return bad(why, 404);
  }

  const batchId = newId();
  for (const r of recipients) {
    await db()
      .prepare("INSERT INTO admin_messages (id, batch_id, from_id, to_id, text, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(newId(), batchId, admin.id, r.id, text, t);
  }
  return Response.json({ sent: recipients.map((r) => r.name) });
}
