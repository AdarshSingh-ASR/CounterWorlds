import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { isPlatformAdmin } from "../../../../lib/auth-server";
import { apiError } from "../../../../lib/http";
import { getSupabaseAdmin } from "../../../../lib/supabase-server";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || !isPlatformAdmin(session.user)) throw new Error("Platform operator access is required");
    const body = await request.json() as { code?: string };
    await auth.api.verifyTOTP({ body: { code: String(body.code ?? ""), trustDevice: false }, headers: request.headers });
    const expiresAt = new Date(Math.min(new Date(session.session.expiresAt).getTime(), Date.now() + 12 * 60 * 60_000)).toISOString();
    const result = await getSupabaseAdmin().from("mfa_session_grants").upsert({ session_id: session.session.id, user_id: session.user.id, verified_at: new Date().toISOString(), expires_at: expiresAt }, { onConflict: "session_id" });
    if (result.error) throw new Error(result.error.message);
    return NextResponse.json({ ok: true, expiresAt });
  } catch (error) { return apiError(error); }
}
