import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildClusters, classifyResponse, GenerationRequestSchema, REFERENCE_WORLDS, WorldManifestSchema } from "../lib/counterworlds";
import { validateWorldHtml, withSandboxCsp } from "../lib/world-validator";

test("classifies common force and mass mental models", () => {
  assert.equal(classifyResponse("The heavier cart accelerates faster because it has more mass"), "mass-amplifies");
  assert.equal(classifyResponse("Both move together because the force is equal"), "same-acceleration");
  assert.equal(classifyResponse("The lighter cart accelerates more because a = F / m"), "canonical");
  assert.equal(classifyResponse("I really do not know"), "uncertain");
});

test("sorts the misconception constellation by adoption", () => {
  const clusters = buildClusters([{ clusterKey: "canonical" }, { clusterKey: "mass-amplifies" }, { clusterKey: "mass-amplifies" }]);
  assert.equal(clusters[0].key, "mass-amplifies");
  assert.equal(clusters[0].count, 2);
});

test("ships three complete, validated reference manifests", () => {
  assert.deepEqual(Object.keys(REFERENCE_WORLDS).sort(), ["chemistry", "mathematics", "physics"]);
  for (const manifest of Object.values(REFERENCE_WORLDS)) {
    assert.doesNotThrow(() => WorldManifestSchema.parse(manifest));
    assert.equal(manifest.sourceModel, "gpt-5.6-sol");
    assert.ok(manifest.controls.length > 0);
  }
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
