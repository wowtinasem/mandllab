import { endInstructorSession } from "@/lib/auth";

export async function POST() {
  await endInstructorSession();
  return Response.json({ ok: true });
}
