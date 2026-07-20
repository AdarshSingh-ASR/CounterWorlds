import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { requireMembership } from "../../../../lib/access";
import { claimLegacySession } from "../../../../lib/classroom-store";
import { apiError } from "../../../../lib/http";

export async function POST(request: Request) {
  try {
    const current = await auth.api.getSession({ headers: request.headers });
    if (!current) throw new Error("Sign in to continue");
    const body = await request.json() as { code?: string; token?: string; organizationId?: string };
    const membership = await requireMembership(current.user.id, body.organizationId);
    await claimLegacySession(String(body.code ?? ""), String(body.token ?? ""), current.user.id, membership.organization_id);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
