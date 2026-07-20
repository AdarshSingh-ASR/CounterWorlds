import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildClusters, GenerationRequestSchema, WorldManifestSchema } from "../lib/counterworlds";
import { validateWorldHtml, withSandboxCsp } from "../lib/world-validator";

test("builds the constellation only from model-generated response mappings", () => {
  const manifest = WorldManifestSchema.parse({
    id: "world-real", slug: "world-real", title: "Live world", domain: "Physics",
    misconceptionLaw: "A", canonicalLaw: "B",
    controls: [{ id: "force", label: "Force", min: 1, max: 5, step: 1, unit: "N" }],
    predictionPrompt: "Which world matches evidence?", evidenceExplanation: "Observed evidence",
    reveal: { correctWorld: "B", explanation: "World B matches" }, reflectionPrompt: "Revise your model",
    sourceModel: "gpt-5.6-sol",
    misconceptionClusters: [
      { id: "cluster-a", label: "Model A", description: "First live model", color: "violet", responseAliases: ["Quiet Quasar", "Brave Nova"] },
      { id: "cluster-b", label: "Model B", description: "Second live model", color: "cyan", responseAliases: ["Keen Comet"] },
    ],
  });
  const clusters = buildClusters(manifest);
  assert.equal(clusters[0].key, "cluster-a");
  assert.equal(clusters[0].count, 2);
});

test("rejects underspecified generation requests", () => {
  assert.throws(() => GenerationRequestSchema.parse({ sessionId: "s", prompt: "tiny", learningObjective: "tiny", canonicalModel: "tiny", responses: [] }));
});

test("blocks network and escape capabilities in generated worlds", () => {
  const base = `<!doctype html><html><head><style>body{color:white}</style></head><body><h1>World A</h1><h1>World B</h1>${"x".repeat(900)}</body></html>`;
  assert.equal(validateWorldHtml(base).valid, true);
  assert.equal(validateWorldHtml(base.replace("</body>", "<script>fetch('https://evil.test')</script></body>")).valid, false);
  assert.equal(validateWorldHtml(base.replace("</body>", "<script>window.parent.location='https://evil.test'</script></body>")).valid, false);
  assert.match(withSandboxCsp(base), /Content-Security-Policy/);
});

test("Supabase migration creates private, RLS-protected persistence", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260718170000_counterworlds.sql", import.meta.url), "utf8");
  for (const table of ["sessions", "memberships", "responses", "predictions", "revisions", "generation_jobs", "worlds"]) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}`));
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.match(sql, /storage\.buckets/);
  assert.match(sql, /'counterworlds', 'counterworlds', false/);
  assert.match(sql, /revoke all[\s\S]*from anon, authenticated/);
});

test("real-data-only migration removes the seeded classroom and fallback status", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20260718193000_real_data_only.sql", import.meta.url), "utf8");
  assert.match(sql, /code = 'ORBIT7'/);
  assert.match(sql, /teacher_token = 'demo-teacher-token'/);
  assert.doesNotMatch(sql.match(/add constraint[\s\S]*$/)?.[0] ?? "", /fallback/);
});

test("generated HTML uses a Supabase-supported storage MIME type", () => {
  const store = readFileSync(new URL("../lib/classroom-store.ts", import.meta.url), "utf8");
  const route = readFileSync(new URL("../app/api/worlds/[slug]/route.ts", import.meta.url), "utf8");
  const worldLab = readFileSync(new URL("../components/WorldLab.tsx", import.meta.url), "utf8");
  assert.match(store, /upload\(artifactKey, payload\.html, \{ contentType: "text\/html", upsert: true \}\)/);
  assert.doesNotMatch(store, /contentType: "text\/html; charset=utf-8"/);
  assert.match(route, /"content-type": "text\/html; charset=utf-8"/);
  assert.doesNotMatch(route, /"content-type": object\.contentType/);
  assert.match(worldLab, /\?format=html-v1/);
});

test("generation retries a rejected artifact and classroom UI hides model names", () => {
  const workflow = readFileSync(new URL("../workflows/generate-counterworld.ts", import.meta.url), "utf8");
  const classroom = readFileSync(new URL("../components/CounterWorldsApp.tsx", import.meta.url), "utf8");
  const worldLab = readFileSync(new URL("../components/WorldLab.tsx", import.meta.url), "utf8");
  assert.match(workflow, /attempt < 2/);
  assert.match(workflow, /previousAttemptRejected/);
  assert.match(workflow, /Building the interactive experiment/);
  assert.doesNotMatch(classroom, /GEMINI 2\.5 FLASH · VERTEX AI|GPT-5\.6 SOL · OPENAI|state\.world\.sourceModel/);
  assert.doesNotMatch(worldLab, /\{world\.sourceModel\}/);
});
