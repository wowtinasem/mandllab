import { currentAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { bad } from "@/lib/http";

/** 메인 관리자: 강사 목록 (수업 수, 가입에 쓴 접근 코드) */
export async function GET() {
  if (!(await currentAdmin())) return bad("메인 관리자만 볼 수 있어요.", 403);
  const instructors = await db()
    .prepare(
      `SELECT i.id, i.email, i.name, i.org, i.role, i.status, i.created_at, a.code AS access_code, a.label AS access_label,
              (SELECT COUNT(*) FROM sessions s WHERE s.instructor_id = i.id) AS session_count,
              (SELECT COUNT(*) FROM sessions s WHERE s.instructor_id = i.id AND s.status = 'active') AS active_count
       FROM instructors i LEFT JOIN access_codes a ON a.id = i.access_code_id
       ORDER BY (i.role = 'admin') DESC, i.created_at DESC`,
    )
    .all();
  return Response.json({ instructors });
}
