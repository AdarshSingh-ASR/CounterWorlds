import { NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "../../../../lib/auth";
import { requireMembership, writeAudit } from "../../../../lib/access";
import { apiError } from "../../../../lib/http";
import { encryptSecret } from "../../../../lib/security";
import { getSupabaseAdmin } from "../../../../lib/supabase-server";

async function context(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Error("Sign in to continue");
  const organizationId = new URL(request.url).searchParams.get("organizationId") ?? undefined;
  const member = await requireMembership(session.user.id, organizationId);
  return { session, member };
}

export async function GET(request: Request) {
  try {
    const { session, member } = await context(request);
    const db = getSupabaseAdmin();
    const personal = await db.from("ai_credentials").select("id,scope,last_four,verified_at,updated_at").eq("owner_user_id", session.user.id).eq("scope", "personal");
    const shared = await db.from("ai_credentials").select("id,scope,last_four,verified_at,updated_at").eq("organization_id", member.organization_id).eq("scope", "organization");
    const settings = await db.from("organization_settings").select("default_ai_provider,shared_credential_id").eq("organization_id", member.organization_id).maybeSingle();
    [personal, shared, settings].forEach((result) => { if (result.error) throw new Error(result.error.message); });
    return NextResponse.json({ personal: personal.data ?? [], shared: shared.data ?? [], settings: settings.data, canManageShared: member.role === "owner" || member.role === "admin" });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const { session, member } = await context(request);
    const body = await request.json() as { apiKey?: string; scope?: "personal" | "organization"; defaultProvider?: string };
    const db = getSupabaseAdmin();
    if (body.defaultProvider) {
      if (member.role !== "owner" && member.role !== "admin") throw new Error("Only school owners and admins can change the workspace AI default");
      const provider = body.defaultProvider === "openai" ? "openai" : "vertex-gemini";
      const updated = await db.from("organization_settings").upsert({ organization_id: member.organization_id, default_ai_provider: provider, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
      if (updated.error) throw new Error(updated.error.message);
      await writeAudit({ actorUserId: session.user.id, organizationId: member.organization_id, action: "ai.default_changed", targetType: "organization", targetId: member.organization_id, metadata: { provider } });
      return NextResponse.json({ ok: true });
    }
    const apiKey = String(body.apiKey ?? "").trim();
    if (!apiKey.startsWith("sk-") || apiKey.length < 20) throw new Error("Enter a valid OpenAI API key");
    const scope = body.scope === "organization" ? "organization" : "personal";
    if (scope === "organization" && member.role !== "owner" && member.role !== "admin") throw new Error("Only school owners and admins can store a shared key");
    await new OpenAI({ apiKey }).models.retrieve("gpt-5.6-sol");
    const encrypted = encryptSecret(apiKey);
    const filter = scope === "personal" ? db.from("ai_credentials").delete().eq("owner_user_id", session.user.id).eq("scope", "personal") : db.from("ai_credentials").delete().eq("organization_id", member.organization_id).eq("scope", "organization");
    if ((await filter).error) throw new Error("Could not replace the previous AI credential");
    const inserted = await db.from("ai_credentials").insert({
      scope,
      provider: "openai",
      owner_user_id: scope === "personal" ? session.user.id : null,
      organization_id: scope === "organization" ? member.organization_id : null,
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      auth_tag: encrypted.authTag,
      key_version: encrypted.keyVersion,
      last_four: encrypted.lastFour,
      verified_at: new Date().toISOString(),
    }).select("id,last_four,verified_at").single();
    if (inserted.error) throw new Error(inserted.error.message);
    if (scope === "organization") await db.from("organization_settings").update({ shared_credential_id: inserted.data.id, updated_at: new Date().toISOString() }).eq("organization_id", member.organization_id);
    await writeAudit({ actorUserId: session.user.id, organizationId: member.organization_id, action: "ai.credential_saved", targetType: "ai_credential", targetId: inserted.data.id, metadata: { scope, lastFour: encrypted.lastFour } });
    return NextResponse.json({ credential: inserted.data }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    const { session, member } = await context(request);
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new Error("Credential id is required");
    const db = getSupabaseAdmin();
    const credential = await db.from("ai_credentials").select("id,scope,owner_user_id,organization_id").eq("id", id).maybeSingle();
    if (credential.error) throw new Error(credential.error.message);
    if (!credential.data) throw new Error("Credential not found");
    const allowed = credential.data.scope === "personal" ? credential.data.owner_user_id === session.user.id : credential.data.organization_id === member.organization_id && (member.role === "owner" || member.role === "admin");
    if (!allowed) throw new Error("Credential access could not be verified");
    const deleted = await db.from("ai_credentials").delete().eq("id", id);
    if (deleted.error) throw new Error(deleted.error.message);
    await writeAudit({ actorUserId: session.user.id, organizationId: member.organization_id, action: "ai.credential_deleted", targetType: "ai_credential", targetId: id });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
