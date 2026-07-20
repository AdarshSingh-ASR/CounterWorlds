import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { getMembership, requireMembership, writeAudit } from "../../../lib/access";
import { apiError } from "../../../lib/http";
import { getSupabaseAdmin } from "../../../lib/supabase-server";

async function current(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Error("Sign in to continue");
  return session;
}

export async function GET(request: Request) {
  try {
    const session = await current(request);
    const member = await getMembership(session.user.id);
    const profile = await getSupabaseAdmin().from("teacher_profiles").select("*").eq("user_id", session.user.id).maybeSingle();
    if (profile.error) throw new Error(profile.error.message);
    let settings = null;
    if (member) {
      const result = await getSupabaseAdmin().from("organization_settings").select("*").eq("organization_id", member.organization_id).maybeSingle();
      if (result.error) throw new Error(result.error.message);
      settings = result.data;
    }
    return NextResponse.json({ user: session.user, profile: profile.data, membership: member, organizationSettings: settings });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await current(request);
    const body = await request.json() as Record<string, unknown>;
    const member = await requireMembership(session.user.id, String(body.organizationId ?? ""));
    if (body.schoolAuthorityConfirmed !== true) throw new Error("Confirm that you are authorized by your school and will use CounterWorlds only with learners aged 13+");
    const db = getSupabaseAdmin();
    const profile = await db.from("teacher_profiles").upsert({
      user_id: session.user.id,
      display_name: String(body.displayName ?? session.user.name).trim().slice(0, 80),
      title: String(body.title ?? "Teacher").trim().slice(0, 80),
      subjects: Array.isArray(body.subjects) ? body.subjects.map(String).slice(0, 10) : [],
      grade_bands: Array.isArray(body.gradeBands) ? body.gradeBands.map(String).slice(0, 8) : [],
      timezone: String(body.timezone ?? "UTC").slice(0, 80),
      terms_version: "2026-07-20",
      terms_accepted_at: new Date().toISOString(),
      school_authority_confirmed_at: new Date().toISOString(),
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (profile.error) throw new Error(profile.error.message);
    const settings = await db.from("organization_settings").upsert({
      organization_id: member.organization_id,
      school_type: String(body.schoolType ?? "secondary-school").slice(0, 80),
      country: String(body.country ?? "").slice(0, 80),
      timezone: String(body.timezone ?? "UTC").slice(0, 80),
      retention_days: 90,
      updated_at: new Date().toISOString(),
    }, { onConflict: "organization_id" });
    if (settings.error) throw new Error(settings.error.message);
    await writeAudit({ actorUserId: session.user.id, organizationId: member.organization_id, action: "onboarding.completed", targetType: "user", targetId: session.user.id });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
