import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GenerationStatusSchema, WorldManifestSchema } from "../lib/counterworlds";
import { decryptSecret, encryptSecret, networkHash, tokenHash, validateNickname } from "../lib/security";

test("nickname guard accepts Unicode aliases and rejects personal contact data",()=>{
  assert.equal(validateNickname("  तारामंडल   मित्र  "),"तारामंडल मित्र");
  assert.throws(()=>validateNickname("student@example.edu"),/contact information/);
  assert.throws(()=>validateNickname("+91 98765 43210"),/contact information/);
  assert.throws(()=>validateNickname("https://example.org"),/contact information/);
  assert.throws(()=>validateNickname("a".repeat(25)),/24 characters/);
});

test("classroom and network identifiers are one-way and separated",()=>{
  process.env.IP_HASH_SECRET="test-only-network-secret";
  assert.equal(tokenHash("membership-token").length,64);
  assert.equal(networkHash("203.0.113.4").length,64);
  assert.notEqual(networkHash("203.0.113.4"),networkHash("203.0.113.5"));
});

test("OpenAI credentials use authenticated AES-256-GCM and reject tampering",()=>{
  process.env.AI_CREDENTIAL_ENCRYPTION_KEY=Buffer.alloc(32,7).toString("base64");
  const encrypted=encryptSecret("sk-test-secret-1234567890");
  assert.equal(encrypted.lastFour,"7890");
  assert.equal(decryptSecret({ciphertext:encrypted.ciphertext,iv:encrypted.iv,auth_tag:encrypted.authTag}),"sk-test-secret-1234567890");
  const tampered=Buffer.from(encrypted.authTag,"base64");tampered[0]^=1;
  assert.throws(()=>decryptSecret({ciphertext:encrypted.ciphertext,iv:encrypted.iv,auth_tag:tampered.toString("base64")}));
});

test("generation contract records provider provenance and has no fallback state",()=>{
  assert.throws(()=>GenerationStatusSchema.parse("fallback"));
  const parsed=WorldManifestSchema.parse({id:"real-world",slug:"real-world",title:"A real world",domain:"Physics",misconceptionLaw:"Mass creates acceleration",canonicalLaw:"Acceleration equals force divided by mass",controls:[{id:"force",label:"Force",min:1,max:10,step:1,unit:"N"}],predictionPrompt:"Which world matches evidence?",evidenceExplanation:"Compare acceleration.",reveal:{correctWorld:"B",explanation:"World B follows F=ma."},reflectionPrompt:"Revise your model.",sourceModel:"gemini-2.5-flash",provider:"vertex-gemini",contractVersion:"cw-world-v2",misconceptionClusters:[{id:"mass",label:"Mass-driven",description:"Heavier carts move faster",color:"violet",responseAliases:["Orbit Friend"]}]});
  assert.equal(parsed.provider,"vertex-gemini");assert.equal(parsed.contractVersion,"cw-world-v2");
});

test("school-pilot migration establishes persistent identity, ownership, and lifecycle controls",()=>{
  const migration=readFileSync(new URL("../supabase/migrations/20260720110000_school_pilot.sql",import.meta.url),"utf8");
  for(const table of ['better_auth."user"','better_auth.session','better_auth.organization','better_auth.member','better_auth.invitation','public.teacher_profiles','public.organization_settings','public.ai_credentials','public.audit_events','public.rate_limit_counters','public.mfa_session_grants'])assert.match(migration,new RegExp(`create table if not exists ${table.replace(/[.\"]/g,"\\$&")}`,"i"));
  for(const column of ["owner_user_id","organization_id","last_activity_at","archived_at","purge_at","access_token_hash","credential_scope","idempotency_key"])assert.match(migration,new RegExp(column));
  assert.doesNotMatch(migration,/insert\s+into\s+public\.sessions/i);
});

test("rate-limit migration uses a timestamp value rather than PostgreSQL CURRENT_TIME",()=>{
  const migration=readFileSync(new URL("../supabase/migrations/20260720163000_fix_rate_limit_timestamp.sql",import.meta.url),"utf8");
  assert.match(migration,/request_now\s+timestamptz\s*:=\s*clock_timestamp\(\)/i);
  assert.doesNotMatch(migration,/\bcurrent_time\s+timestamptz\b/i);
  assert.match(migration,/values\s*\(counter_key,\s*1,\s*request_now,/i);
});
