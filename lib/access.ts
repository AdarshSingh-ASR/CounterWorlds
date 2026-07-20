import { getSupabaseAdmin } from "./supabase-server";
import { sql } from "./db";

export type OrganizationRole = "owner" | "admin" | "member";

export async function getMembership(userId: string, organizationId?: string | null) {
  const result = organizationId
    ? await sql<{ organization_id: string; role: OrganizationRole; name: string }>(
        `select m."organizationId" as organization_id, m.role, o.name
         from better_auth.member m join better_auth.organization o on o.id = m."organizationId"
         where m."userId" = $1 and m."organizationId" = $2 limit 1`, [userId, organizationId])
    : await sql<{ organization_id: string; role: OrganizationRole; name: string }>(
        `select m."organizationId" as organization_id, m.role, o.name
         from better_auth.member m join better_auth.organization o on o.id = m."organizationId"
         where m."userId" = $1 order by m."createdAt" limit 1`, [userId]);
  return result.rows[0] ?? null;
}

export async function requireMembership(userId: string, organizationId?: string | null) {
  const member = await getMembership(userId, organizationId);
  if (!member) throw new Error("Complete school onboarding to continue");
  return member;
}

export async function requireClassroomOwner(code: string, userId: string) {
  const result = await getSupabaseAdmin().from("sessions").select("id,organization_id,status,owner_user_id")
    .eq("code", code.toUpperCase()).eq("owner_user_id", userId).maybeSingle();
  if (result.error) throw new Error(result.error.message);
  if (!result.data) throw new Error("Classroom access could not be verified");
  return result.data;
}

export async function writeAudit(input: {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  networkHash?: string | null;
}) {
  const result = await getSupabaseAdmin().from("audit_events").insert({
    actor_user_id: input.actorUserId ?? null,
    organization_id: input.organizationId ?? null,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
    network_hash: input.networkHash ?? null,
  });
  if (result.error) throw new Error(result.error.message);
}

export async function consumeRateLimit(key: string, maximum: number, windowSeconds: number) {
  const result = await getSupabaseAdmin().rpc("consume_rate_limit", { counter_key: key, maximum, window_seconds: windowSeconds });
  if (result.error) throw new Error(result.error.message);
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  if (!row?.allowed) {
    const error = new Error("Too many requests. Please try again later.") as Error & { retryAfter?: number };
    error.retryAfter = Number(row?.retry_after ?? windowSeconds);
    throw error;
  }
}
