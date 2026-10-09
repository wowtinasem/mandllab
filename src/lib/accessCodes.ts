import "server-only";
import crypto from "node:crypto";
import { db, now } from "./db";

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 글자로 "T-ABCD-2345" 모양의 강사 접근 코드를 만든다
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function part(len: number) {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** "t abcd 2345", "TABCD2345" 처럼 입력해도 "T-ABCD-2345" 로 맞춘다 */
export function normalizeAccessCode(input: string) {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = raw.length === 9 && raw.startsWith("T") ? raw.slice(1) : raw;
  return body.length === 8 ? `T-${body.slice(0, 4)}-${body.slice(4)}` : input.trim().toUpperCase();
}

export async function issueAccessCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = `T-${part(4)}-${part(4)}`;
    if (!(await db().prepare("SELECT 1 FROM access_codes WHERE code = ?").get(code))) return code;
  }
  throw new Error("접근 코드 발급 실패");
}

/**
 * 접근 코드를 한 번 쓴다. 쓸 수 있으면 코드 id, 아니면 이유를 돌려준다.
 * 사용 횟수는 조건부 UPDATE 한 문장으로 올려서 동시에 가입해도 인원을 넘지 않는다.
 */
export async function consumeAccessCode(input: string): Promise<{ id: string } | { error: string }> {
  const code = normalizeAccessCode(input);
  const row = (await db().prepare("SELECT * FROM access_codes WHERE code = ?").get(code)) as
    | { id: string; active: number; expires_at: number | null }
    | undefined;
  if (!row) return { error: "강사 접근 코드를 다시 확인해 주세요." };
  if (!row.active) return { error: "사용이 중지된 접근 코드예요. 관리자에게 문의해 주세요." };
  if (row.expires_at && row.expires_at <= now()) return { error: "기간이 지난 접근 코드예요. 관리자에게 새 코드를 받아 주세요." };
  const r = await db()
    .prepare(
      `UPDATE access_codes SET used_count = used_count + 1
       WHERE id = ? AND active = 1 AND used_count < max_uses AND (expires_at IS NULL OR expires_at > ?)`,
    )
    .run(row.id, now());
  if (r.changes !== 1) return { error: "이 접근 코드로 가입할 수 있는 인원이 다 찼어요. 관리자에게 문의해 주세요." };
  return { id: row.id };
}
