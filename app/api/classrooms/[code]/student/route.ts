import { NextResponse } from "next/server";
import { consumeRateLimit } from "../../../../../lib/access";
import { getClassroom, submitPrediction, submitResponse, submitRevision } from "../../../../../lib/classroom-store";
import { apiError } from "../../../../../lib/http";
import { tokenHash } from "../../../../../lib/security";

function bearer(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try { return NextResponse.json(await getClassroom((await params).code, { studentToken: bearer(request) })); }
  catch (error) { return apiError(error, 404); }
}

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = (await params).code;
    const token = bearer(request);
    await consumeRateLimit(`student:${tokenHash(token)}`, 20, 60);
    await consumeRateLimit(`student:classroom:${code.toUpperCase()}`, 120, 60);
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "respond") await submitResponse(code, token, String(body.answer ?? ""));
    else if (body.action === "predict") await submitPrediction(code, token, body.selectedWorld === "A" ? "A" : "B", String(body.evidence ?? ""));
    else if (body.action === "revise") await submitRevision(code, token, String(body.beforeBelief ?? ""), String(body.afterBelief ?? ""));
    else throw new Error("Unknown student action");
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
