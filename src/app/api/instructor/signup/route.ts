import { db, now } from "@/lib/db";
import { hashPassword, newId, startInstructorSession } from "@/lib/auth";
import { bad, readJson, str } from "@/lib/http";

export async function POST(req: Request) {
  const b = await readJson<{ email: string; name: string; org: string; password: string; inviteKey: string }>(req);
  const required = process.env.INSTRUCTOR_INVITE_KEY;
  if (required && str(b.inviteKey) !== required) return bad("강사 초대 키가 올바르지 않아요.", 403);

  const email = str(b.email, 120).toLowerCase();
  const name = str(b.name, 40);
  const org = str(b.org, 60);
  const password = String(b.password ?? "");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad("이메일 형식을 확인해 주세요.");
  if (!name) return bad("이름을 입력해 주세요.");
  if (password.length < 8) return bad("비밀번호는 8자 이상이어야 해요.");
  if (db().prepare("SELECT 1 FROM instructors WHERE email = ?").get(email)) return bad("이미 가입한 이메일이에요.", 409);

  const id = newId();
  db()
    .prepare("INSERT INTO instructors (id, email, name, org, pw_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, email, name, org, hashPassword(password), now());
  await startInstructorSession(id);
  return Response.json({ ok: true });
}
