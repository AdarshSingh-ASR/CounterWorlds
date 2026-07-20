import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { consumeRateLimit } from "../../../../lib/access";
import { classroomLifecycle, getClassroom, teacherAction } from "../../../../lib/classroom-store";
import { apiError } from "../../../../lib/http";

export const dynamic = "force-dynamic";

async function currentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Error("Sign in to continue");
  return session.user;
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await currentUser(request);
    return NextResponse.json(await getClassroom((await params).code, { teacherUserId: user.id }));
  } catch (error) { return apiError(error, 404); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await currentUser(request);
    const code = (await params).code;
    const body = await request.json() as { action?: "close" | "queue" | "launch" | "reveal" | "archive" | "restore" };
    if (body.action === "archive" || body.action === "restore") {
      await classroomLifecycle(code, user.id, body.action);
      return NextResponse.json({ ok: true });
    }
    if (!body.action || !["close", "queue", "launch", "reveal"].includes(body.action)) throw new Error("Unknown classroom action");
    if (body.action === "queue") {
      await consumeRateLimit(`generation:teacher:${user.id}`, 30, 86_400);
      await consumeRateLimit(`generation:classroom:${code.toUpperCase()}`, 5, 3600);
    }
    const jobId = await teacherAction(code, user.id, body.action);
    return NextResponse.json({ ok: true, jobId });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const user = await currentUser(request);
    const code = (await params).code;
    const body = await request.json().catch(() => ({})) as { confirmation?: string };
    if (body.confirmation !== code.toUpperCase()) throw new Error("Type the classroom code to confirm permanent deletion");
    await classroomLifecycle(code, user.id, "delete");
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
