import { buildClusters, randomAlias, randomCode, WorldManifestSchema, type ClassroomState, type WorldManifest } from "./counterworlds";
import { getSupabaseAdmin, requireWorkerToken } from "./supabase-server";

type SessionRow = {
  id: string;
  code: string;
  teacher_token: string;
  question: string;
  learning_objective: string;
  canonical_model: string;
  domain: string;
  status: ClassroomState["session"]["status"];
  world_slug: string | null;
};

type ResponseRow = { id: string; alias: string; answer: string; cluster_key: string };
type PredictionRow = { alias: string; selected_world: "A" | "B"; evidence: string };
type RevisionRow = { alias: string; before_belief: string; after_belief: string; changed: boolean };
type JobRow = { id: string; session_id: string; status: string; stage: string; progress: number; world_slug: string | null; error: string | null };

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function ensureSchema() {
  // Supabase schema is managed by supabase/migrations, not at request time.
}

export async function createSession(input: { question: string; learningObjective: string; canonicalModel: string; domain?: string }) {
  if (input.question.trim().length < 10 || input.learningObjective.trim().length < 10 || input.canonicalModel.trim().length < 10) {
    throw new Error("Question, learning objective, and canonical model must each contain at least 10 characters");
  }
  const db = getSupabaseAdmin();
  let code = randomCode();
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const exists = await db.from("sessions").select("id").eq("code", code).maybeSingle();
    fail(exists.error);
    if (!exists.data) break;
    code = randomCode();
  }
  const id = crypto.randomUUID();
  const teacherToken = crypto.randomUUID();
  const inserted = await db.from("sessions").insert({ id, code, teacher_token: teacherToken, question: input.question.trim().slice(0, 800), learning_objective: input.learningObjective.trim().slice(0, 800), canonical_model: input.canonicalModel.trim().slice(0, 1600), domain: (input.domain ?? "Physics").trim().slice(0, 80) || "Physics" });
  fail(inserted.error);
  return { id, code, teacherToken };
}

export async function joinSession(code: string) {
  const db = getSupabaseAdmin();
  const sessionResult = await db.from("sessions").select("id,status").eq("code", code.toUpperCase()).maybeSingle();
  fail(sessionResult.error);
  if (!sessionResult.data) throw new Error("No classroom found for that code");
  if (sessionResult.data.status !== "collecting") throw new Error("This classroom has closed its belief poll");
  const countResult = await db.from("memberships").select("id", { count: "exact", head: true }).eq("session_id", sessionResult.data.id);
  fail(countResult.error);
  const alias = `${randomAlias(Number(countResult.count ?? 0) + Math.floor(Math.random() * 8))} ${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
  const accessToken = crypto.randomUUID();
  const inserted = await db.from("memberships").insert({ id: crypto.randomUUID(), session_id: sessionResult.data.id, alias, access_token: accessToken });
  fail(inserted.error);
  return { alias, accessToken };
}

async function requireStudent(sessionId: string, accessToken: string) {
  const result = await getSupabaseAdmin().from("memberships").select("alias").eq("session_id", sessionId).eq("access_token", accessToken).maybeSingle();
  fail(result.error);
  if (!result.data) throw new Error("Student access could not be verified");
  return String(result.data.alias);
}

async function requireTeacher(code: string, teacherToken: string) {
  const result = await getSupabaseAdmin().from("sessions").select("id").eq("code", code.toUpperCase()).eq("teacher_token", teacherToken).maybeSingle();
  fail(result.error);
  if (!result.data) throw new Error("Teacher access could not be verified");
  return String(result.data.id);
}

export async function submitResponse(code: string, accessToken: string, answer: string) {
  if (answer.trim().length < 8) throw new Error("Explain your model in at least 8 characters");
  const db = getSupabaseAdmin();
  const result = await db.from("sessions").select("id,status").eq("code", code.toUpperCase()).maybeSingle();
  fail(result.error);
  if (!result.data) throw new Error("Classroom not found");
  if (result.data.status !== "collecting") throw new Error("This classroom has closed its belief poll");
  const alias = await requireStudent(String(result.data.id), accessToken);
  const removed = await db.from("responses").delete().eq("session_id", result.data.id).eq("alias", alias);
  fail(removed.error);
  const inserted = await db.from("responses").insert({ id: crypto.randomUUID(), session_id: result.data.id, alias: alias.slice(0, 40), answer: answer.slice(0, 1200), cluster_key: "pending-ai-analysis" });
  fail(inserted.error);
}

export async function teacherAction(code: string, teacherToken: string, action: "close" | "queue" | "launch" | "reveal") {
  const db = getSupabaseAdmin();
  const sessionId = await requireTeacher(code, teacherToken);
  if (action === "close") {
    const result = await db.from("sessions").update({ status: "generating" }).eq("id", sessionId);
    fail(result.error); return;
  }
  if (action === "queue") {
    const responseCount = await db.from("responses").select("id", { count: "exact", head: true }).eq("session_id", sessionId);
    fail(responseCount.error);
    if (!responseCount.count) throw new Error("At least one real student explanation is required before generation");
    const open = await db.from("generation_jobs").select("id").eq("session_id", sessionId).not("status", "in", "(failed,ready)").order("created_at", { ascending: false }).limit(1).maybeSingle();
    fail(open.error);
    if (!open.data) {
      const created = await db.from("generation_jobs").insert({ id: crypto.randomUUID(), session_id: sessionId, status: "queued", stage: "Reading class beliefs", progress: 8 });
      fail(created.error);
    }
    const updated = await db.from("sessions").update({ status: "generating" }).eq("id", sessionId);
    fail(updated.error); return;
  }
  const updated = await db.from("sessions").update({ status: action === "launch" ? "launched" : "revealed" }).eq("id", sessionId);
  fail(updated.error);
}

export async function submitPrediction(code: string, accessToken: string, selectedWorld: "A" | "B", evidence: string) {
  if (evidence.trim().length < 5) throw new Error("Record the evidence behind your prediction");
  const db = getSupabaseAdmin();
  const session = await db.from("sessions").select("id").eq("code", code.toUpperCase()).maybeSingle();
  fail(session.error); if (!session.data) throw new Error("Classroom not found");
  const alias = await requireStudent(String(session.data.id), accessToken);
  const result = await db.from("predictions").upsert({ id: crypto.randomUUID(), session_id: session.data.id, alias, selected_world: selectedWorld, evidence: evidence.slice(0, 800) }, { onConflict: "session_id,alias" });
  fail(result.error);
}

export async function submitRevision(code: string, accessToken: string, beforeBelief: string, afterBelief: string) {
  if (afterBelief.trim().length < 10) throw new Error("Explain your revised model in at least 10 characters");
  const db = getSupabaseAdmin();
  const session = await db.from("sessions").select("id").eq("code", code.toUpperCase()).maybeSingle();
  fail(session.error); if (!session.data) throw new Error("Classroom not found");
  const alias = await requireStudent(String(session.data.id), accessToken);
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const result = await db.from("revisions").upsert({ id: crypto.randomUUID(), session_id: session.data.id, alias, before_belief: beforeBelief.slice(0, 1200), after_belief: afterBelief.slice(0, 1200), changed: normalize(beforeBelief) !== normalize(afterBelief) }, { onConflict: "session_id,alias" });
  fail(result.error);
}

export async function getClassroom(code: string, viewer: { teacherToken?: string; studentToken?: string } = {}): Promise<ClassroomState> {
  const db = getSupabaseAdmin();
  const sessionResult = await db.from("sessions").select("id,code,teacher_token,question,learning_objective,canonical_model,domain,status,world_slug").eq("code", code.toUpperCase()).maybeSingle();
  fail(sessionResult.error); if (!sessionResult.data) throw new Error("Classroom not found");
  const session = sessionResult.data as SessionRow;
  const isTeacher = Boolean(viewer.teacherToken) && viewer.teacherToken === session.teacher_token;
  const studentResult = !isTeacher && viewer.studentToken ? await db.from("memberships").select("alias").eq("session_id", session.id).eq("access_token", viewer.studentToken).maybeSingle() : null;
  if (studentResult) fail(studentResult.error);
  const studentAlias = studentResult?.data?.alias ? String(studentResult.data.alias) : null;
  const [responsesResult, predictionsResult, revisionsResult, jobResult] = await Promise.all([
    db.from("responses").select("id,alias,answer,cluster_key").eq("session_id", session.id).order("created_at"),
    db.from("predictions").select("alias,selected_world,evidence").eq("session_id", session.id).order("created_at"),
    db.from("revisions").select("alias,before_belief,after_belief,changed").eq("session_id", session.id).order("created_at"),
    db.from("generation_jobs").select("id,session_id,status,stage,progress,world_slug,error").eq("session_id", session.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  [responsesResult, predictionsResult, revisionsResult, jobResult].forEach((result) => fail(result.error));
  const allResponses = ((responsesResult.data ?? []) as ResponseRow[]).map((row) => ({ id: row.id, alias: row.alias, answer: row.answer, clusterKey: row.cluster_key }));
  const allPredictions = (predictionsResult.data ?? []) as PredictionRow[];
  const allRevisions = (revisionsResult.data ?? []) as RevisionRow[];
  const job = jobResult.data as JobRow | null;
  let manifest: WorldManifest | null = null;
  if (session.world_slug) {
    const worldResult = await db.from("worlds").select("manifest").eq("slug", session.world_slug).eq("validation_status", "verified").maybeSingle();
    fail(worldResult.error);
    const parsed = WorldManifestSchema.safeParse(worldResult.data?.manifest);
    if (parsed.success) manifest = parsed.data;
  }
  const clusterByAlias = new Map<string, string>();
  for (const cluster of manifest?.misconceptionClusters ?? []) {
    for (const alias of cluster.responseAliases) clusterByAlias.set(alias, cluster.id);
  }
  const mappedResponses = allResponses.map((response) => ({ ...response, clusterKey: clusterByAlias.get(response.alias) ?? response.clusterKey }));
  const canSeeReveal = isTeacher || session.status === "revealed";
  return {
    session: { id: session.id, code: session.code, question: session.question, learningObjective: session.learning_objective, canonicalModel: isTeacher || session.status === "revealed" ? session.canonical_model : "", domain: session.domain, status: session.status, worldSlug: session.world_slug },
    responses: isTeacher ? mappedResponses : mappedResponses.filter((row) => row.alias === studentAlias),
    predictions: (isTeacher ? allPredictions : allPredictions.filter((row) => row.alias === studentAlias)).map((row) => ({ alias: row.alias, selectedWorld: row.selected_world, evidence: row.evidence })),
    revisions: (isTeacher ? allRevisions : allRevisions.filter((row) => row.alias === studentAlias)).map((row) => ({ alias: row.alias, beforeBelief: row.before_belief, afterBelief: row.after_belief, changed: row.changed })),
    job: job ? { id: job.id, status: job.status as NonNullable<ClassroomState["job"]>["status"], stage: job.stage, progress: job.progress, worldSlug: job.world_slug, error: job.error } : null,
    clusters: isTeacher ? buildClusters(manifest) : [],
    world: manifest ? {
      slug: manifest.slug,
      title: manifest.title,
      predictionPrompt: manifest.predictionPrompt,
      reflectionPrompt: manifest.reflectionPrompt,
      sourceModel: manifest.sourceModel,
      reveal: canSeeReveal ? manifest.reveal : null,
      evidenceExplanation: canSeeReveal ? manifest.evidenceExplanation : "",
    } : null,
  };
}

export async function getNextJob(workerToken: string) {
  requireWorkerToken(workerToken);
  const db = getSupabaseAdmin();
  const result = await db.from("generation_jobs").select("id,session_id,status,stage,progress,world_slug,error").eq("status", "queued").order("created_at").limit(1).maybeSingle();
  fail(result.error); if (!result.data) return null;
  const job = result.data as JobRow;
  const claimed = await db.from("generation_jobs").update({ status: "analyzing", stage: "Mapping competing mental models", progress: 22, updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "queued");
  fail(claimed.error);
  const [session, responses] = await Promise.all([
    db.from("sessions").select("question,learning_objective,canonical_model").eq("id", job.session_id).single(),
    db.from("responses").select("alias,answer").eq("session_id", job.session_id).order("created_at"),
  ]);
  fail(session.error); fail(responses.error);
  if (!session.data) throw new Error("Generation session not found");
  return { jobId: job.id, sessionId: job.session_id, prompt: String(session.data.question), learningObjective: String(session.data.learning_objective), canonicalModel: String(session.data.canonical_model), responses: responses.data ?? [] };
}

export async function updateJobProgress(workerToken: string, payload: { jobId: string; status: "generating" | "validating"; stage: string; progress: number }) {
  requireWorkerToken(workerToken);
  const progress = Math.max(23, Math.min(99, Math.round(payload.progress)));
  const result = await getSupabaseAdmin().from("generation_jobs").update({
    status: payload.status,
    stage: payload.stage.slice(0, 200),
    progress,
    updated_at: new Date().toISOString(),
  }).eq("id", payload.jobId).in("status", ["analyzing", "generating", "validating"]);
  fail(result.error);
}

export async function completeJob(workerToken: string, payload: { jobId: string; worldSlug: string; manifest: unknown; html?: string; status: "ready" | "failed"; error?: string }) {
  requireWorkerToken(workerToken);
  const db = getSupabaseAdmin();
  const jobResult = await db.from("generation_jobs").select("session_id").eq("id", payload.jobId).maybeSingle();
  fail(jobResult.error); if (!jobResult.data) throw new Error("Generation job not found");
  const sessionId = String(jobResult.data.session_id);
  if (payload.status === "failed") {
    const failed = await db.from("generation_jobs").update({ status: "failed", stage: "Generation failed", error: payload.error ?? "Unknown generation error", updated_at: new Date().toISOString() }).eq("id", payload.jobId);
    fail(failed.error);
    return;
  }
  const parsedManifest = WorldManifestSchema.parse(payload.manifest);
  const publishedSlug = `cw-${sessionId}-${payload.jobId}`.toLowerCase();
  const manifest: WorldManifest = { ...parsedManifest, id: publishedSlug, slug: publishedSlug };
  let artifactKey: string | null = null;
  if (payload.html) {
    artifactKey = `worlds/${publishedSlug}.html`;
    const uploaded = await db.storage.from("counterworlds").upload(artifactKey, payload.html, { contentType: "text/html; charset=utf-8", upsert: true });
    fail(uploaded.error);
  }
  const results = await Promise.all([
    db.from("worlds").upsert({ id: crypto.randomUUID(), slug: publishedSlug, session_id: sessionId, manifest, artifact_key: artifactKey, source_model: "gpt-5.6-sol", validation_status: "verified" }, { onConflict: "slug" }),
    db.from("generation_jobs").update({ status: "ready", stage: "CounterWorld verified", progress: 100, world_slug: publishedSlug, updated_at: new Date().toISOString() }).eq("id", payload.jobId),
    db.from("sessions").update({ status: "world-ready", world_slug: publishedSlug }).eq("id", sessionId),
  ]);
  results.forEach((result) => fail(result.error));
}

export async function getWorldArtifact(slug: string) {
  const db = getSupabaseAdmin();
  const row = await db.from("worlds").select("artifact_key").eq("slug", slug).eq("validation_status", "verified").maybeSingle();
  fail(row.error); if (!row.data?.artifact_key) return null;
  const downloaded = await db.storage.from("counterworlds").download(String(row.data.artifact_key));
  fail(downloaded.error); if (!downloaded.data) return null;
  return { body: downloaded.data, contentType: downloaded.data.type || "text/html; charset=utf-8" };
}
