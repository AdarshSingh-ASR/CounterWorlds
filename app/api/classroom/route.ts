import { NextResponse } from "next/server";
import { createSession, getClassroom, joinSession, submitPrediction, submitResponse, submitRevision, teacherAction } from "../../../lib/classroom-store";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown, status = 400) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "Something went wrong" }, { status });
}

export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get("code")?.toUpperCase();
    if (!code) return errorResponse(new Error("A classroom code is required"));
    return NextResponse.json(await getClassroom(code, {
      teacherToken: request.headers.get("x-counterworlds-teacher-token") ?? undefined,
      studentToken: request.headers.get("x-counterworlds-student-token") ?? undefined,
    }));
  } catch (error) {
    return errorResponse(error, 404);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");
    if (action === "create") {
      return NextResponse.json(await createSession({ question: String(body.question ?? ""), learningObjective: String(body.learningObjective ?? ""), canonicalModel: String(body.canonicalModel ?? ""), domain: String(body.domain ?? "Physics") }));
    }
    if (action === "join") return NextResponse.json(await joinSession(String(body.code ?? "")));
    if (action === "respond") {
      await submitResponse(String(body.code ?? ""), String(body.accessToken ?? ""), String(body.answer ?? ""));
      return NextResponse.json({ ok: true });
    }
    if (["close", "queue", "launch", "reveal", "fallback", "reset"].includes(action)) {
      await teacherAction(String(body.code ?? ""), String(body.teacherToken ?? ""), action as "close" | "queue" | "launch" | "reveal" | "fallback" | "reset");
      return NextResponse.json({ ok: true });
    }
    if (action === "predict") {
      await submitPrediction(String(body.code ?? ""), String(body.accessToken ?? ""), body.selectedWorld === "A" ? "A" : "B", String(body.evidence ?? ""));
      return NextResponse.json({ ok: true });
    }
    if (action === "revise") {
      await submitRevision(String(body.code ?? ""), String(body.accessToken ?? ""), String(body.beforeBelief ?? ""), String(body.afterBelief ?? ""));
      return NextResponse.json({ ok: true });
    }
    return errorResponse(new Error("Unknown classroom action"));
  } catch (error) {
    return errorResponse(error);
  }
}
