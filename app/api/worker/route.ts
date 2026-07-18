import { NextResponse } from "next/server";
import { completeJob, getNextJob, updateJobProgress } from "../../../lib/classroom-store";
import { validateWorldHtml, withSandboxCsp } from "../../../lib/world-validator";
import { WorldManifestSchema } from "../../../lib/counterworlds";

export const dynamic = "force-dynamic";

function bearer(request: Request) {
  return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
}

export async function GET(request: Request) {
  try {
    return NextResponse.json({ job: await getNextJob(bearer(request)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Worker request failed" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (body.status === "generating" || body.status === "validating") {
      await updateJobProgress(bearer(request), {
        jobId: String(body.jobId),
        status: body.status,
        stage: String(body.stage ?? "Generation in progress"),
        progress: Number(body.progress ?? 50),
      });
      return NextResponse.json({ ok: true });
    }
    if (body.status === "failed") {
      await completeJob(bearer(request), { jobId: String(body.jobId), worldSlug: String(body.worldSlug ?? "generated"), manifest: body.manifest ?? {}, status: "failed", error: String(body.error ?? "Generation failed") });
      return NextResponse.json({ ok: true });
    }
    const html = String(body.html ?? "");
    const validation = validateWorldHtml(html);
    const manifest = WorldManifestSchema.parse(body.manifest);
    if (!validation.valid) return NextResponse.json({ error: "World artifact did not pass safety validation", details: validation.errors }, { status: 422 });
    await completeJob(bearer(request), { jobId: String(body.jobId), worldSlug: manifest.slug, manifest, html: withSandboxCsp(html), status: "ready" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Worker update failed" }, { status: 400 });
  }
}
