import { currentInstructor } from "@/lib/auth";
import { isMockMode } from "@/lib/ai";

export async function GET() {
  const instructor = await currentInstructor();
  return Response.json({
    instructor,
    mockMode: isMockMode(),
    inviteRequired: Boolean(process.env.INSTRUCTOR_INVITE_KEY),
  });
}
