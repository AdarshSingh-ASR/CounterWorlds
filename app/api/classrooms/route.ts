import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { auth } from "../../../lib/auth";
import { consumeRateLimit, requireMembership } from "../../../lib/access";
import { createSession, listSessions } from "../../../lib/classroom-store";
import { apiError } from "../../../lib/http";
import { getSupabaseAdmin } from "../../../lib/supabase-server";
import { generateCounterWorld } from "../../../workflows/generate-counterworld";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function session(request: Request) {
  const current = await auth.api.getSession({ headers: request.headers });
  if (!current) throw new Error("Sign in to continue");
  return current;
}

export async function GET(request: Request) {
  try {
    const current = await session(request);
    return NextResponse.json({ classrooms: await listSessions(current.user.id) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const current = await session(request);
    await consumeRateLimit(`classroom:create:${current.user.id}`, 20, 3600);
    const body = await request.json() as Record<string, unknown>;
    const member = await requireMembership(current.user.id, String(body.organizationId ?? ""));
    const provider = body.aiProvider === "openai" ? "openai" : "vertex-gemini";
    let credentialId = typeof body.credentialId === "string" && body.credentialId ? body.credentialId : null;
    if (provider === "openai") {
      const credential = credentialId ? await getSupabaseAdmin().from("ai_credentials").select("id,scope,owner_user_id,organization_id")
        .eq("id", credentialId).maybeSingle() : null;
      if (!credential?.data || (credential.data.scope === "personal" && credential.data.owner_user_id !== current.user.id) || (credential.data.scope === "organization" && credential.data.organization_id !== member.organization_id)) {
        throw new Error("Select a verified OpenAI credential you are allowed to use");
      }
    } else credentialId = null;
    const classroom = await createSession({
      userId: current.user.id,
      organizationId: member.organization_id,
      question: String(body.question ?? ""),
      learningObjective: String(body.learningObjective ?? ""),
      canonicalModel: String(body.canonicalModel ?? ""),
      domain: String(body.domain ?? "Physics"),
      aiProvider: provider,
      credentialId,
    });
    return NextResponse.json(classroom, { status: 201 });
  } catch (error) { return apiError(error); }
}

// Static reference keeps the workflow discoverable by the Next.js integration.
export async function PUT(request: Request) {
  try {
    const current = await session(request);
    const body = await request.json() as { jobId?: string };
    if (!body.jobId) throw new Error("A generation job is required");
    const db = getSupabaseAdmin();
    const job = await db.from("generation_jobs").select("id,session_id").eq("id", body.jobId).maybeSingle();
    if (job.error) throw new Error(job.error.message);
    if (!job.data) throw new Error("Generation access could not be verified");
    const classroom = await db.from("sessions").select("owner_user_id").eq("id", job.data.session_id).maybeSingle();
    if (classroom.error) throw new Error(classroom.error.message);
    if (classroom.data?.owner_user_id !== current.user.id) throw new Error("Generation access could not be verified");
    const run = await start(generateCounterWorld, [body.jobId]);
    return NextResponse.json({ runId: run.runId, jobId: body.jobId }, { status: 202 });
  } catch (error) { return apiError(error); }
}
