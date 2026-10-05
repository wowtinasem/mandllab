import { cookies } from "next/headers";
import { PARTICIPANT_COOKIE } from "@/lib/auth";

export async function POST() {
  (await cookies()).delete(PARTICIPANT_COOKIE);
  return Response.json({ ok: true });
}
