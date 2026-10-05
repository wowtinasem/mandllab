import { currentInstructor } from "@/lib/auth";
import { isMockMode } from "@/lib/ai";
import { isEphemeralDb } from "@/lib/db";

export async function GET() {
  const instructor = await currentInstructor();
  return Response.json({
    instructor,
    mockMode: isMockMode(),
    dbMissing: isEphemeralDb(),
    inviteRequired: Boolean(process.env.INSTRUCTOR_INVITE_KEY),
  });
}
