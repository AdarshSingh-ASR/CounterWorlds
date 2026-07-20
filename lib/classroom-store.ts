import {
  buildClusters,
  randomCode,
  WorldManifestSchema,
  type ClassroomState,
  type GenerationProvider,
  type WorldManifest,
} from "./counterworlds";
import { getSupabaseAdmin, requireWorkerToken } from "./supabase-server";
import { tokenHash, validateNickname } from "./security";
import { writeAudit } from "./access";

type SessionRow = {
  id: string;
  code: string;
  teacher_token: string | null;
  owner_user_id: string | null;
  organization_id: string | null;
  question: string;
  learning_objective: string;
  canonical_model: string;
  domain: string;
  status: ClassroomState["session"]["status"];
  world_slug: string | null;
  ai_provider: GenerationProvider;
  archived_at: string | null;
};

type ResponseRow = { id: string; alias: string; answer: string; cluster_key: string };
type PredictionRow = { alias: string; selected_world: "A" | "B"; evidence: string };
type RevisionRow = { alias: string; before_belief: string; after_belief: string; changed: boolean };
type JobRow = { id: string; session_id: string; status: string; stage: string; progress: number; world_slug: string | null; error: string | null; provider?: GenerationProvider; model?: string };

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function now() { return new Date().toISOString(); }

export async function createSession(input: {
  userId: string;
  organizationId: string;
  question: string;
  learningObjective: string;
  canonicalModel: string;
  domain?: string;
  aiProvider?: GenerationProvider;
  credentialId?: string | null;
}) {
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
  const inserted = await db.from("sessions").insert({
    id,
    code,
    teacher_token: null,
    owner_user_id: input.userId,
    organization_id: input.organizationId,
    question: input.question.trim().slice(0, 800),
    learning_objective: input.learningObjective.trim().slice(0, 800),
    canonical_model: input.canonicalModel.trim().slice(0, 1600),
    domain: (input.domain ?? "Physics").trim().slice(0, 80) || "Physics",
    ai_provider: input.aiProvider ?? "vertex-gemini",
    credential_id: input.credentialId ?? null,
    updated_at: now(),
    last_activity_at: now(),
  });
  fail(inserted.error);
  await writeAudit({ actorUserId: input.userId, organizationId: input.organizationId, action: "classroom.created", targetType: "session", targetId: id });
  return { id, code };
}

export async function listSessions(userId: string) {
  const db = getSupabaseAdmin();
  const sessions = await db.from("sessions")
    .select("id,code,question,learning_objective,domain,status,world_slug,ai_provider,created_at,updated_at,archived_at,purge_at")
    .eq("owner_user_id", userId).order("created_at", { ascending: false });
  fail(sessions.error);
  const rows = sessions.data ?? [];
  const ids = rows.map((row) => row.id);
  if (!ids.length) return [];
  const [memberships, responses, revisions] = await Promise.all([
    db.from("memberships").select("session_id").in("session_id", ids),
    db.from("responses").select("session_id").in("session_id", ids),
    db.from("revisions").select("session_id,changed").in("session_id", ids),
  ]);
  [memberships, responses, revisions].forEach((result) => fail(result.error));
  const count = (items: Array<{ session_id: string }> | null, id: string) => (items ?? []).filter((item) => item.session_id === id).length;
  return rows.map((row) => ({
    ...row,
    students: count(memberships.data, row.id),
    responses: count(responses.data, row.id),
    revisions: count(revisions.data, row.id),
    changed: (revisions.data ?? []).filter((item) => item.session_id === row.id && item.changed).length,
  }));
}

export async function joinSession(codeValue: string, nicknameValue: string, noticeAccepted: boolean) {
  if (!noticeAccepted) throw new Error("Acknowledge the student privacy notice to join");
  const code = codeValue.toUpperCase();
  const nickname = validateNickname(nicknameValue);
  const db = getSupabaseAdmin();
  const sessionResult = await db.from("sessions").select("id,status").eq("code", code).maybeSingle();
  fail(sessionResult.error);
  if (!sessionResult.data || sessionResult.data.status !== "collecting") throw new Error("This classroom code is invalid or closed");
  const existing = await db.from("memberships").select("alias").eq("session_id", sessionResult.data.id).ilike("alias", `${nickname}%`);
  fail(existing.error);
  const aliases = new Set((existing.data ?? []).map((row) => String(row.alias).toLowerCase()));
  let alias = nickname;
  for (let suffix = 2; aliases.has(alias.toLowerCase()); suffix += 1) alias = `${nickname.slice(0, 20)} ${suffix}`;
  const accessToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const inserted = await db.from("memberships").insert({
    id: crypto.randomUUID(),
    session_id: sessionResult.data.id,
    alias,
    access_token: null,
    access_token_hash: tokenHash(accessToken),
    notice_version: "student-privacy-2026-07-20",
    notice_acknowledged_at: now(),
  });
  fail(inserted.error);
  return { alias, accessToken };
}

async function requireStudent(sessionId: string, accessToken: string) {
  if (!accessToken) throw new Error("Student access could not be verified");
  const db = getSupabaseAdmin();
  const hashed = await db.from("memberships").select("alias").eq("session_id", sessionId).eq("access_token_hash", tokenHash(accessToken)).maybeSingle();
  fail(hashed.error);
  if (hashed.data) return String(hashed.data.alias);
  const legacy = await db.from("memberships").select("alias").eq("session_id", sessionId).eq("access_token", accessToken).maybeSingle();
  fail(legacy.error);
  if (!legacy.data) throw new Error("Student access could not be verified");
  return String(legacy.data.alias);
}

export async function submitResponse(code: string, accessToken: string, answer: string) {
  if (answer.trim().length < 8) throw new Error("Explain your model in at least 8 characters");
  const db = getSupabaseAdmin();
  const result = await db.from("sessions").select("id,status").eq("code", code.toUpperCase()).maybeSingle();
  fail(result.error);
  if (!result.data || result.data.status !== "collecting") throw new Error("This classroom code is invalid or closed");
  const alias = await requireStudent(String(result.data.id), accessToken);
  const inserted = await db.from("responses").upsert({
    id: crypto.randomUUID(), session_id: result.data.id, alias: alias.slice(0, 40), answer: answer.trim().slice(0, 1200), cluster_key: "pending-ai-analysis",
  }, { onConflict: "session_id,alias" });
  fail(inserted.error);
  fail((await db.from("sessions").update({ last_activity_at: now(), updated_at: now() }).eq("id", result.data.id)).error);
}

export async function teacherAction(code: string, userId: string, action: "close" | "queue" | "launch" | "reveal") {
  const db = getSupabaseAdmin();
  const session = await db.from("sessions").select("id,organization_id,ai_provider,credential_id,status").eq("code", code.toUpperCase()).eq("owner_user_id", userId).maybeSingle();
  fail(session.error);
  if (!session.data) throw new Error("Classroom access could not be verified");
  if (session.data.status === "archived") throw new Error("Restore this classroom before changing it");
  if (action === "close") {
    fail((await db.from("sessions").update({ status: "generating", updated_at: now(), last_activity_at: now() }).eq("id", session.data.id)).error);
    return null;
  }
  if (action === "queue") {
    const responseCount = await db.from("responses").select("id", { count: "exact", head: true }).eq("session_id", session.data.id);
    fail(responseCount.error);
    if (!responseCount.count) throw new Error("At least one real student explanation is required before generation");
    const open = await db.from("generation_jobs").select("id").eq("session_id", session.data.id).not("status", "in", "(failed,ready)").order("created_at", { ascending: false }).limit(1).maybeSingle();
    fail(open.error);
    if (open.data) return String(open.data.id);
    const jobId = crypto.randomUUID();
    const provider = session.data.ai_provider as GenerationProvider;
    let credentialScope: "platform" | "organization" | "personal" = "platform";
    if (session.data.credential_id) {
      const credential = await db.from("ai_credentials").select("scope").eq("id", session.data.credential_id).maybeSingle();
      fail(credential.error);
      if (!credential.data) throw new Error("The selected AI credential is no longer available");
      credentialScope = credential.data.scope === "organization" ? "organization" : "personal";
    }
    const created = await db.from("generation_jobs").insert({
      id: jobId,
      session_id: session.data.id,
      status: "queued",
      stage: "Reading class beliefs",
      progress: 8,
      provider,
      model: provider === "openai" ? "gpt-5.6-sol" : "gemini-2.5-flash",
      credential_scope: credentialScope,
      idempotency_key: `${session.data.id}:cw-world-v2:${Date.now()}`,
    });
    fail(created.error);
    fail((await db.from("sessions").update({ status: "generating", updated_at: now(), last_activity_at: now() }).eq("id", session.data.id)).error);
    return jobId;
  }
  const status = action === "launch" ? "launched" : "revealed";
  fail((await db.from("sessions").update({ status, updated_at: now(), last_activity_at: now(), ended_at: action === "reveal" ? now() : null }).eq("id", session.data.id)).error);
  await writeAudit({ actorUserId: userId, organizationId: session.data.organization_id, action: `classroom.${action}`, targetType: "session", targetId: session.data.id });
  return null;
}

export async function classroomLifecycle(code: string, userId: string, action: "archive" | "restore" | "delete") {
  const db = getSupabaseAdmin();
  const session = await db.from("sessions").select("id,organization_id,world_slug").eq("code", code.toUpperCase()).eq("owner_user_id", userId).maybeSingle();
  fail(session.error);
  if (!session.data) throw new Error("Classroom access could not be verified");
  if (action === "delete") {
    if (session.data.world_slug) {
      const world = await db.from("worlds").select("artifact_key").eq("slug", session.data.world_slug).maybeSingle();
      fail(world.error);
      if (world.data?.artifact_key) fail((await db.storage.from("counterworlds").remove([String(world.data.artifact_key)])).error);
      fail((await db.from("worlds").delete().eq("slug", session.data.world_slug)).error);
    }
    fail((await db.from("sessions").delete().eq("id", session.data.id)).error);
  } else if (action === "archive") {
    const archivedAt = now();
    const purgeAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
    fail((await db.from("sessions").update({ status: "archived", archived_at: archivedAt, purge_at: purgeAt, updated_at: archivedAt }).eq("id", session.data.id)).error);
  } else {
    fail((await db.from("sessions").update({ status: "revealed", archived_at: null, purge_at: null, updated_at: now() }).eq("id", session.data.id)).error);
  }
  await writeAudit({ actorUserId: userId, organizationId: session.data.organization_id, action: `classroom.${action}`, targetType: "session", targetId: session.data.id });
}

export async function claimLegacySession(code: string, legacyToken: string, userId: string, organizationId: string) {
  const db = getSupabaseAdmin();
  const session = await db.from("sessions").select("id,teacher_token,owner_user_id").eq("code", code.toUpperCase()).maybeSingle();
  fail(session.error);
  if (!session.data || session.data.owner_user_id || !session.data.teacher_token || session.data.teacher_token !== legacyToken) throw new Error("This legacy classroom cannot be claimed");
  const claimed = await db.from("sessions").update({ owner_user_id: userId, organization_id: organizationId, teacher_token: null, updated_at: now() })
    .eq("id", session.data.id).eq("teacher_token", legacyToken).is("owner_user_id", null).select("id").maybeSingle();
  fail(claimed.error);
  if (!claimed.data) throw new Error("This classroom was already claimed");
  await writeAudit({ actorUserId: userId, organizationId, action: "classroom.legacy_claimed", targetType: "session", targetId: session.data.id });
  return { ok: true };
}

export async function submitPrediction(code: string, accessToken: string, selectedWorld: "A" | "B", evidence: string) {
  if (evidence.trim().length < 5) throw new Error("Record the evidence behind your prediction");
  const db = getSupabaseAdmin();
  const session = await db.from("sessions").select("id,status").eq("code", code.toUpperCase()).maybeSingle();
  fail(session.error); if (!session.data || session.data.status === "archived") throw new Error("Classroom not found");
  const alias = await requireStudent(String(session.data.id), accessToken);
  const result = await db.from("predictions").upsert({ id: crypto.randomUUID(), session_id: session.data.id, alias, selected_world: selectedWorld, evidence: evidence.trim().slice(0, 800) }, { onConflict: "session_id,alias" });
  fail(result.error);
}

export async function submitRevision(code: string, accessToken: string, beforeBelief: string, afterBelief: string) {
  if (afterBelief.trim().length < 10) throw new Error("Explain your revised model in at least 10 characters");
  const db = getSupabaseAdmin();
  const session = await db.from("sessions").select("id,status").eq("code", code.toUpperCase()).maybeSingle();
  fail(session.error); if (!session.data || session.data.status !== "revealed") throw new Error("The evidence reveal is not open");
  const alias = await requireStudent(String(session.data.id), accessToken);
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  const result = await db.from("revisions").upsert({ id: crypto.randomUUID(), session_id: session.data.id, alias, before_belief: beforeBelief.slice(0, 1200), after_belief: afterBelief.trim().slice(0, 1200), changed: normalize(beforeBelief) !== normalize(afterBelief) }, { onConflict: "session_id,alias" });
  fail(result.error);
}

export async function getClassroom(code: string, viewer: { teacherUserId?: string; studentToken?: string } = {}): Promise<ClassroomState> {
  const db = getSupabaseAdmin();
  const sessionResult = await db.from("sessions").select("id,code,teacher_token,owner_user_id,organization_id,question,learning_objective,canonical_model,domain,status,world_slug,ai_provider,archived_at").eq("code", code.toUpperCase()).maybeSingle();
  fail(sessionResult.error); if (!sessionResult.data) throw new Error("Classroom not found");
  const session = sessionResult.data as SessionRow;
  const isTeacher = Boolean(viewer.teacherUserId) && viewer.teacherUserId === session.owner_user_id;
  const studentAlias = !isTeacher && viewer.studentToken ? await requireStudent(session.id, viewer.studentToken).catch(() => null) : null;
  if (!isTeacher && !studentAlias) throw new Error("Classroom access could not be verified");
  const [responsesResult, predictionsResult, revisionsResult, jobResult] = await Promise.all([
    db.from("responses").select("id,alias,answer,cluster_key").eq("session_id", session.id).order("created_at"),
    db.from("predictions").select("alias,selected_world,evidence").eq("session_id", session.id).order("created_at"),
    db.from("revisions").select("alias,before_belief,after_belief,changed").eq("session_id", session.id).order("created_at"),
    db.from("generation_jobs").select("id,session_id,status,stage,progress,world_slug,error,provider,model").eq("session_id", session.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
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
  for (const cluster of manifest?.misconceptionClusters ?? []) for (const alias of cluster.responseAliases) clusterByAlias.set(alias, cluster.id);
  const mappedResponses = allResponses.map((response) => ({ ...response, clusterKey: clusterByAlias.get(response.alias) ?? response.clusterKey }));
  const canSeeReveal = isTeacher || session.status === "revealed" || session.status === "archived";
  return {
    session: {
      id: session.id, code: session.code, question: session.question, learningObjective: session.learning_objective,
      canonicalModel: isTeacher || canSeeReveal ? session.canonical_model : "", domain: session.domain, status: session.status,
      worldSlug: session.world_slug, aiProvider: session.ai_provider, archivedAt: session.archived_at,
    },
    responses: isTeacher ? mappedResponses : mappedResponses.filter((row) => row.alias === studentAlias),
    predictions: (isTeacher ? allPredictions : allPredictions.filter((row) => row.alias === studentAlias)).map((row) => ({ alias: row.alias, selectedWorld: row.selected_world, evidence: row.evidence })),
    revisions: (isTeacher ? allRevisions : allRevisions.filter((row) => row.alias === studentAlias)).map((row) => ({ alias: row.alias, beforeBelief: row.before_belief, afterBelief: row.after_belief, changed: row.changed })),
    job: job ? { id: job.id, status: job.status as NonNullable<ClassroomState["job"]>["status"], stage: job.stage, progress: job.progress, worldSlug: job.world_slug, error: job.error } : null,
    clusters: isTeacher ? buildClusters(manifest) : [],
    world: manifest ? {
      slug: manifest.slug, title: manifest.title, predictionPrompt: manifest.predictionPrompt, reflectionPrompt: manifest.reflectionPrompt,
      sourceModel: manifest.sourceModel, provider: manifest.provider, reveal: canSeeReveal ? manifest.reveal : null,
      evidenceExplanation: canSeeReveal ? manifest.evidenceExplanation : "",
    } : null,
  };
}

export async function getGenerationJob(jobId: string) {
  const db = getSupabaseAdmin();
  const job = await db.from("generation_jobs").select("id,session_id,status,provider,model,attempts").eq("id", jobId).maybeSingle();
  fail(job.error); if (!job.data) throw new Error("Generation job not found");
  const claimed = await db.from("generation_jobs").update({ status: "analyzing", stage: "Mapping competing mental models", progress: 22, started_at: now(), attempts: Number(job.data.attempts ?? 0) + 1, updated_at: now() }).eq("id", jobId).eq("status", "queued").select("id").maybeSingle();
  fail(claimed.error); if (!claimed.data && job.data.status !== "analyzing") throw new Error("Generation job was already processed");
  const [session, responses] = await Promise.all([
    db.from("sessions").select("question,learning_objective,canonical_model,domain,ai_provider,credential_id").eq("id", job.data.session_id).single(),
    db.from("responses").select("alias,answer").eq("session_id", job.data.session_id).order("created_at"),
  ]);
  fail(session.error); fail(responses.error);
  return { jobId, sessionId: job.data.session_id, provider: job.data.provider as GenerationProvider, model: String(job.data.model), ...session.data, responses: responses.data ?? [] };
}

export async function updateGenerationJob(jobId: string, status: "generating" | "validating", stage: string, progress: number) {
  const result = await getSupabaseAdmin().from("generation_jobs").update({ status, stage: stage.slice(0, 200), progress: Math.max(23, Math.min(99, Math.round(progress))), updated_at: now() }).eq("id", jobId);
  fail(result.error);
}

export async function publishGeneration(jobId: string, payload: { manifest: unknown; html: string; provider: GenerationProvider; model: string }) {
  const db = getSupabaseAdmin();
  const jobResult = await db.from("generation_jobs").select("session_id").eq("id", jobId).maybeSingle();
  fail(jobResult.error); if (!jobResult.data) throw new Error("Generation job not found");
  const parsed = WorldManifestSchema.parse(payload.manifest);
  const slug = `cw-${jobResult.data.session_id}-${jobId}`.toLowerCase();
  const manifest: WorldManifest = { ...parsed, id: slug, slug, provider: payload.provider, sourceModel: payload.model as WorldManifest["sourceModel"], contractVersion: "cw-world-v2" };
  const artifactKey = `worlds/${slug}.html`;
  // Supabase Storage accepts the MIME type here, but rejects parameters such as
  // `charset=utf-8`. The serving route adds the charset to the response header.
  fail((await db.storage.from("counterworlds").upload(artifactKey, payload.html, { contentType: "text/html", upsert: true })).error);
  const results = await Promise.all([
    db.from("worlds").upsert({ id: crypto.randomUUID(), slug, session_id: jobResult.data.session_id, manifest, artifact_key: artifactKey, source_model: payload.model, provider: payload.provider, contract_version: "cw-world-v2", validation_status: "verified" }, { onConflict: "slug" }),
    db.from("generation_jobs").update({ status: "ready", stage: "CounterWorld verified", progress: 100, world_slug: slug, completed_at: now(), updated_at: now() }).eq("id", jobId),
    db.from("sessions").update({ status: "world-ready", world_slug: slug, updated_at: now() }).eq("id", jobResult.data.session_id),
  ]);
  results.forEach((result) => fail(result.error));
}

export async function failGeneration(jobId: string, error: unknown, category = "provider_or_validation") {
  const message = error instanceof Error ? error.message : "Generation failed";
  const result = await getSupabaseAdmin().from("generation_jobs").update({ status: "failed", stage: "Generation failed", error: message.slice(0, 600), failure_category: category, completed_at: now(), updated_at: now() }).eq("id", jobId);
  fail(result.error);
}

// Explicitly local-only compatibility path for the Codex SDK worker.
export async function getNextJob(workerToken: string) {
  requireWorkerToken(workerToken);
  if (process.env.ENABLE_LOCAL_CODEX_WORKER !== "true") throw new Error("The local Codex worker is disabled");
  const db = getSupabaseAdmin();
  const result = await db.from("generation_jobs").select("id").eq("status", "queued").order("created_at").limit(1).maybeSingle();
  fail(result.error); if (!result.data) return null;
  const job = await getGenerationJob(String(result.data.id));
  return { jobId: job.jobId, sessionId: job.sessionId, prompt: String(job.question), learningObjective: String(job.learning_objective), canonicalModel: String(job.canonical_model), responses: job.responses };
}

export async function updateJobProgress(workerToken: string, payload: { jobId: string; status: "generating" | "validating"; stage: string; progress: number }) {
  requireWorkerToken(workerToken);
  if (process.env.ENABLE_LOCAL_CODEX_WORKER !== "true") throw new Error("The local Codex worker is disabled");
  return updateGenerationJob(payload.jobId, payload.status, payload.stage, payload.progress);
}

export async function completeJob(workerToken: string, payload: { jobId: string; worldSlug: string; manifest: unknown; html?: string; status: "ready" | "failed"; error?: string }) {
  requireWorkerToken(workerToken);
  if (process.env.ENABLE_LOCAL_CODEX_WORKER !== "true") throw new Error("The local Codex worker is disabled");
  if (payload.status === "failed") return failGeneration(payload.jobId, new Error(payload.error ?? "Local worker failed"), "local_worker");
  return publishGeneration(payload.jobId, { manifest: payload.manifest, html: payload.html ?? "", provider: "openai", model: "gpt-5.6-sol" });
}

export async function getWorldArtifact(slug: string) {
  const db = getSupabaseAdmin();
  const row = await db.from("worlds").select("artifact_key").eq("slug", slug).eq("validation_status", "verified").maybeSingle();
  fail(row.error); if (!row.data?.artifact_key) return null;
  const downloaded = await db.storage.from("counterworlds").download(String(row.data.artifact_key));
  fail(downloaded.error); if (!downloaded.data) return null;
  return { body: downloaded.data, contentType: downloaded.data.type || "text/html; charset=utf-8" };
}
