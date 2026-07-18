import { env } from "cloudflare:workers";
import { buildClusters, classifyResponse, randomAlias, randomCode, REFERENCE_WORLDS, type ClassroomState } from "./counterworlds";

type D1ResultRow = Record<string, string | number | null>;

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, teacher_token TEXT NOT NULL, question TEXT NOT NULL, learning_objective TEXT NOT NULL, canonical_model TEXT NOT NULL, domain TEXT NOT NULL DEFAULT 'Physics', status TEXT NOT NULL DEFAULT 'collecting', world_slug TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS memberships (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, alias TEXT NOT NULL, access_token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS responses (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, alias TEXT NOT NULL, answer TEXT NOT NULL, cluster_key TEXT NOT NULL DEFAULT 'unclassified', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS predictions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, alias TEXT NOT NULL, selected_world TEXT NOT NULL, evidence TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, alias TEXT NOT NULL, before_belief TEXT NOT NULL, after_belief TEXT NOT NULL, changed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS generation_jobs (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', stage TEXT NOT NULL DEFAULT 'queued', progress INTEGER NOT NULL DEFAULT 0, world_slug TEXT, error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS worlds (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, session_id TEXT, manifest TEXT NOT NULL, artifact_key TEXT, source_model TEXT NOT NULL, validation_status TEXT NOT NULL DEFAULT 'verified', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS responses_session_idx ON responses(session_id)`,
  `CREATE INDEX IF NOT EXISTS jobs_status_idx ON generation_jobs(status, created_at)`,
];

function db() {
  const binding = (env as unknown as { DB?: D1Database }).DB;
  if (!binding) throw new Error("CounterWorlds database binding is unavailable");
  return binding;
}

let initialized = false;
export async function ensureSchema() {
  if (initialized) return;
  const binding = db();
  await binding.batch(schemaStatements.map((statement) => binding.prepare(statement)));
  initialized = true;
}

export async function ensureDemoSession() {
  await ensureSchema();
  const binding = db();
  const existing = await binding.prepare("SELECT id FROM sessions WHERE code = ?").bind("ORBIT7").first();
  if (existing) return;
  const sessionId = crypto.randomUUID();
  await binding.batch([
    binding
      .prepare("INSERT INTO sessions (id, code, teacher_token, question, learning_objective, canonical_model, domain, status, world_slug) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(
        sessionId,
        "ORBIT7",
        "demo-teacher-token",
        "Two carts—1 kg and 4 kg—are pushed with the same constant force. Which accelerates more, and why?",
        "Use evidence to relate force, mass, and acceleration.",
        "Newton's second law gives a = F/m. For the same force, the lower-mass cart accelerates more.",
        "Physics",
        "collecting",
        null,
      ),
    ...[
      ["Luminous Pulsar", "The heavier cart accelerates more because the same push has more mass to work with."],
      ["Curious Photon", "The 4 kg cart should move farther. Heavier things carry more force."],
      ["Quiet Nova", "They get the same force, so they should accelerate together."],
      ["Brave Comet", "The light cart accelerates more because a = F divided by m."],
      ["Keen Meteor", "More mass means more momentum, so the heavy cart gets ahead."],
      ["Patient Nebula", "I think the smaller cart changes speed faster, but I am not sure why."],
    ].map(([alias, answer]) =>
      binding
        .prepare("INSERT INTO responses (id, session_id, alias, answer, cluster_key) VALUES (?, ?, ?, ?, ?)")
        .bind(crypto.randomUUID(), sessionId, alias, answer, classifyResponse(answer)),
    ),
  ]);
}

export async function createSession(input: { question: string; learningObjective: string; canonicalModel: string; domain?: string }) {
  await ensureSchema();
  const binding = db();
  let code = randomCode();
  while (await binding.prepare("SELECT id FROM sessions WHERE code = ?").bind(code).first()) code = randomCode();
  const id = crypto.randomUUID();
  const teacherToken = crypto.randomUUID();
  await binding
    .prepare("INSERT INTO sessions (id, code, teacher_token, question, learning_objective, canonical_model, domain) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, code, teacherToken, input.question, input.learningObjective, input.canonicalModel, input.domain ?? "Physics")
    .run();
  return { id, code, teacherToken };
}

export async function joinSession(code: string) {
  await ensureDemoSession();
  const binding = db();
  const session = await binding.prepare("SELECT id FROM sessions WHERE code = ?").bind(code.toUpperCase()).first();
  if (!session) throw new Error("No classroom found for that code");
  const count = await binding.prepare("SELECT COUNT(*) AS count FROM responses WHERE session_id = ?").bind(session.id).first<{ count: number }>();
  const alias = randomAlias(Number(count?.count ?? 0) + Math.floor(Math.random() * 8));
  const accessToken = crypto.randomUUID();
  await binding.prepare("INSERT INTO memberships (id, session_id, alias, access_token) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), session.id, alias, accessToken).run();
  return { alias, accessToken };
}

async function requireStudent(sessionId: string, accessToken: string) {
  const member = await db().prepare("SELECT alias FROM memberships WHERE session_id = ? AND access_token = ?").bind(sessionId, accessToken).first<{ alias: string }>();
  if (!member) throw new Error("Student access could not be verified");
  return member.alias;
}

export async function submitResponse(code: string, accessToken: string, answer: string) {
  await ensureSchema();
  const binding = db();
  const session = await binding.prepare("SELECT id, status FROM sessions WHERE code = ?").bind(code.toUpperCase()).first<{ id: string; status: string }>();
  if (!session) throw new Error("Classroom not found");
  if (session.status !== "collecting" && code.toUpperCase() !== "ORBIT7") throw new Error("This classroom has closed its belief poll");
  const alias = await requireStudent(session.id, accessToken);
  await binding.prepare("DELETE FROM responses WHERE session_id = ? AND alias = ?").bind(session.id, alias).run();
  await binding
    .prepare("INSERT INTO responses (id, session_id, alias, answer, cluster_key) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), session.id, alias.slice(0, 40), answer.slice(0, 1200), classifyResponse(answer))
    .run();
}

async function requireTeacher(code: string, teacherToken: string) {
  const session = await db().prepare("SELECT id FROM sessions WHERE code = ? AND teacher_token = ?").bind(code.toUpperCase(), teacherToken).first<{ id: string }>();
  if (!session) throw new Error("Teacher access could not be verified");
  return session.id;
}

export async function teacherAction(code: string, teacherToken: string, action: "close" | "queue" | "launch" | "reveal" | "fallback" | "reset") {
  await ensureSchema();
  const binding = db();
  const sessionId = await requireTeacher(code, teacherToken);
  if (action === "reset") {
    if (code.toUpperCase() !== "ORBIT7") throw new Error("Only the demo classroom can be reset");
    await binding.batch([
      binding.prepare("DELETE FROM generation_jobs WHERE session_id = ?").bind(sessionId),
      binding.prepare("DELETE FROM predictions WHERE session_id = ?").bind(sessionId),
      binding.prepare("DELETE FROM revisions WHERE session_id = ?").bind(sessionId),
      binding.prepare("UPDATE sessions SET status = 'collecting', world_slug = NULL WHERE id = ?").bind(sessionId),
    ]);
    return;
  }
  if (action === "close") {
    await binding.prepare("UPDATE sessions SET status = 'generating' WHERE id = ?").bind(sessionId).run();
    return;
  }
  if (action === "queue") {
    const openJob = await binding.prepare("SELECT id FROM generation_jobs WHERE session_id = ? AND status NOT IN ('failed', 'ready', 'fallback') ORDER BY created_at DESC LIMIT 1").bind(sessionId).first();
    if (!openJob) {
      await binding.prepare("INSERT INTO generation_jobs (id, session_id, status, stage, progress) VALUES (?, ?, 'queued', 'Reading class beliefs', 8)").bind(crypto.randomUUID(), sessionId).run();
    }
    await binding.prepare("UPDATE sessions SET status = 'generating' WHERE id = ?").bind(sessionId).run();
    return;
  }
  if (action === "fallback") {
    await binding.prepare("UPDATE generation_jobs SET status = 'fallback', stage = 'Verified reference world ready', progress = 100, world_slug = 'physics', updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND status NOT IN ('ready', 'fallback')").bind(sessionId).run();
    await binding.prepare("UPDATE sessions SET status = 'world-ready', world_slug = 'physics' WHERE id = ?").bind(sessionId).run();
    return;
  }
  await binding.prepare("UPDATE sessions SET status = ? WHERE id = ?").bind(action === "launch" ? "launched" : "revealed", sessionId).run();
}

export async function submitPrediction(code: string, accessToken: string, selectedWorld: "A" | "B", evidence: string) {
  await ensureSchema();
  const binding = db();
  const session = await binding.prepare("SELECT id FROM sessions WHERE code = ?").bind(code.toUpperCase()).first<{ id: string }>();
  if (!session) throw new Error("Classroom not found");
  const alias = await requireStudent(session.id, accessToken);
  await binding.prepare("DELETE FROM predictions WHERE session_id = ? AND alias = ?").bind(session.id, alias).run();
  await binding.prepare("INSERT INTO predictions (id, session_id, alias, selected_world, evidence) VALUES (?, ?, ?, ?, ?)").bind(crypto.randomUUID(), session.id, alias, selectedWorld, evidence.slice(0, 800)).run();
}

export async function submitRevision(code: string, accessToken: string, beforeBelief: string, afterBelief: string) {
  await ensureSchema();
  const binding = db();
  const session = await binding.prepare("SELECT id FROM sessions WHERE code = ?").bind(code.toUpperCase()).first<{ id: string }>();
  if (!session) throw new Error("Classroom not found");
  const alias = await requireStudent(session.id, accessToken);
  const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");
  await binding.prepare("DELETE FROM revisions WHERE session_id = ? AND alias = ?").bind(session.id, alias).run();
  await binding.prepare("INSERT INTO revisions (id, session_id, alias, before_belief, after_belief, changed) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), session.id, alias, beforeBelief.slice(0, 1200), afterBelief.slice(0, 1200), normalize(beforeBelief) !== normalize(afterBelief) ? 1 : 0).run();
}

export async function getClassroom(code: string, viewer: { teacherToken?: string; studentToken?: string } = {}): Promise<ClassroomState> {
  await ensureDemoSession();
  const binding = db();
  const session = await binding.prepare("SELECT id, code, teacher_token, question, learning_objective, canonical_model, domain, status, world_slug FROM sessions WHERE code = ?").bind(code.toUpperCase()).first<D1ResultRow>();
  if (!session) throw new Error("Classroom not found");
  const isTeacher = Boolean(viewer.teacherToken) && viewer.teacherToken === session.teacher_token;
  const student = !isTeacher && viewer.studentToken
    ? await binding.prepare("SELECT alias FROM memberships WHERE session_id = ? AND access_token = ?").bind(session.id, viewer.studentToken).first<{ alias: string }>()
    : null;
  const [responsesResult, predictionsResult, revisionsResult, job] = await Promise.all([
    binding.prepare("SELECT id, alias, answer, cluster_key FROM responses WHERE session_id = ? ORDER BY created_at ASC").bind(session.id).all<D1ResultRow>(),
    binding.prepare("SELECT alias, selected_world, evidence FROM predictions WHERE session_id = ? ORDER BY created_at ASC").bind(session.id).all<D1ResultRow>(),
    binding.prepare("SELECT alias, before_belief, after_belief, changed FROM revisions WHERE session_id = ? ORDER BY created_at ASC").bind(session.id).all<D1ResultRow>(),
    binding.prepare("SELECT id, status, stage, progress, world_slug, error FROM generation_jobs WHERE session_id = ? ORDER BY created_at DESC LIMIT 1").bind(session.id).first<D1ResultRow>(),
  ]);
  const allResponses = responsesResult.results.map((row) => ({ id: String(row.id), alias: String(row.alias), answer: String(row.answer), clusterKey: String(row.cluster_key) }));
  const responses = isTeacher ? allResponses : allResponses.filter((row) => row.alias === student?.alias);
  const allPredictions = predictionsResult.results.map((row) => ({ alias: String(row.alias), selectedWorld: String(row.selected_world) as "A" | "B", evidence: String(row.evidence) }));
  const allRevisions = revisionsResult.results.map((row) => ({ alias: String(row.alias), beforeBelief: String(row.before_belief), afterBelief: String(row.after_belief), changed: Boolean(row.changed) }));
  return {
    session: {
      id: String(session.id), code: String(session.code), question: String(session.question), learningObjective: String(session.learning_objective), canonicalModel: isTeacher || session.status === "revealed" ? String(session.canonical_model) : "", domain: String(session.domain), status: String(session.status) as ClassroomState["session"]["status"], worldSlug: session.world_slug ? String(session.world_slug) : null,
    },
    responses,
    predictions: isTeacher ? allPredictions : allPredictions.filter((row) => row.alias === student?.alias),
    revisions: isTeacher ? allRevisions : allRevisions.filter((row) => row.alias === student?.alias),
    job: job ? { id: String(job.id), status: String(job.status) as ClassroomState["job"] extends infer T ? T extends { status: infer S } ? S : never : never, stage: String(job.stage), progress: Number(job.progress), worldSlug: job.world_slug ? String(job.world_slug) : null, error: job.error ? String(job.error) : null } : null,
    clusters: isTeacher ? buildClusters(allResponses) : [],
  };
}

export async function getNextJob(workerToken: string) {
  await ensureSchema();
  const expected = (env as unknown as Record<string, unknown>).COUNTERWORLDS_WORKER_TOKEN;
  if (!expected || workerToken !== expected) throw new Error("Worker authorization failed");
  const binding = db();
  const job = await binding.prepare("SELECT id, session_id FROM generation_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1").first<{ id: string; session_id: string }>();
  if (!job) return null;
  await binding.prepare("UPDATE generation_jobs SET status = 'analyzing', stage = 'Mapping competing mental models', progress = 22, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(job.id).run();
  const session = await binding.prepare("SELECT question, learning_objective, canonical_model FROM sessions WHERE id = ?").bind(job.session_id).first<{ question: string; learning_objective: string; canonical_model: string }>();
  const responseRows = await binding.prepare("SELECT alias, answer FROM responses WHERE session_id = ? ORDER BY created_at").bind(job.session_id).all<{ alias: string; answer: string }>();
  return { jobId: job.id, sessionId: job.session_id, prompt: session?.question ?? "", learningObjective: session?.learning_objective ?? "", canonicalModel: session?.canonical_model ?? "", responses: responseRows.results };
}

export async function completeJob(workerToken: string, payload: { jobId: string; worldSlug: string; manifest: unknown; html?: string; status: "ready" | "failed"; error?: string }) {
  await ensureSchema();
  const expected = (env as unknown as Record<string, unknown>).COUNTERWORLDS_WORKER_TOKEN;
  if (!expected || workerToken !== expected) throw new Error("Worker authorization failed");
  const binding = db();
  const job = await binding.prepare("SELECT session_id FROM generation_jobs WHERE id = ?").bind(payload.jobId).first<{ session_id: string }>();
  if (!job) throw new Error("Generation job not found");
  if (payload.status === "failed") {
    await binding.prepare("UPDATE generation_jobs SET status = 'failed', stage = 'Generation failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payload.error ?? "Unknown generation error", payload.jobId).run();
    return;
  }
  let artifactKey: string | null = null;
  if (payload.html) {
    const bucket = (env as unknown as { WORLDS?: R2Bucket }).WORLDS;
    if (bucket) {
      artifactKey = `worlds/${payload.worldSlug}.html`;
      await bucket.put(artifactKey, payload.html, { httpMetadata: { contentType: "text/html; charset=utf-8" } });
    }
  }
  await binding.batch([
    binding.prepare("INSERT OR REPLACE INTO worlds (id, slug, session_id, manifest, artifact_key, source_model, validation_status) VALUES (?, ?, ?, ?, ?, 'gpt-5.6-sol', 'verified')").bind(crypto.randomUUID(), payload.worldSlug, job.session_id, JSON.stringify(payload.manifest), artifactKey),
    binding.prepare("UPDATE generation_jobs SET status = 'ready', stage = 'CounterWorld verified', progress = 100, world_slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(payload.worldSlug, payload.jobId),
    binding.prepare("UPDATE sessions SET status = 'world-ready', world_slug = ? WHERE id = ?").bind(payload.worldSlug, job.session_id),
  ]);
}

export async function getWorldArtifact(slug: string) {
  await ensureSchema();
  if (REFERENCE_WORLDS[slug]) return null;
  const row = await db().prepare("SELECT artifact_key FROM worlds WHERE slug = ? AND validation_status = 'verified'").bind(slug).first<{ artifact_key: string | null }>();
  if (!row?.artifact_key) return null;
  const bucket = (env as unknown as { WORLDS?: R2Bucket }).WORLDS;
  return bucket?.get(row.artifact_key) ?? null;
}
