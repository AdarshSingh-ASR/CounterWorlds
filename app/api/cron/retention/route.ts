import { NextResponse } from "next/server";
import { writeAudit } from "../../../../lib/access";
import { apiError } from "../../../../lib/http";
import { getSupabaseAdmin } from "../../../../lib/supabase-server";

export async function GET(request: Request) {
  try {
    const expected = process.env.CRON_SECRET;
    if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) throw new Error("Cron authorization failed");
    const db = getSupabaseAdmin();
    const now = new Date();
    const revealedCutoff = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const abandonedCutoff = new Date(now.getTime() - 30 * 86_400_000).toISOString();
    const purgeAt = new Date(now.getTime() + 90 * 86_400_000).toISOString();
    const revealed = await db.from("sessions").update({ status: "archived", archived_at: now.toISOString(), purge_at: purgeAt, updated_at: now.toISOString() }).eq("status", "revealed").lt("last_activity_at", revealedCutoff).select("id,organization_id");
    if (revealed.error) throw new Error(revealed.error.message);
    const abandoned = await db.from("sessions").update({ status: "archived", archived_at: now.toISOString(), purge_at: purgeAt, updated_at: now.toISOString() }).in("status", ["collecting", "generating", "world-ready", "launched"]).lt("last_activity_at", abandonedCutoff).select("id,organization_id");
    if (abandoned.error) throw new Error(abandoned.error.message);
    const due = await db.from("sessions").select("id,organization_id,world_slug").eq("status", "archived").lte("purge_at", now.toISOString()).limit(100);
    if (due.error) throw new Error(due.error.message);
    for (const session of due.data ?? []) {
      if (session.world_slug) {
        const world = await db.from("worlds").select("artifact_key").eq("slug", session.world_slug).maybeSingle();
        if (world.data?.artifact_key) await db.storage.from("counterworlds").remove([String(world.data.artifact_key)]);
        await db.from("worlds").delete().eq("slug", session.world_slug);
      }
      await writeAudit({ organizationId: session.organization_id, action: "classroom.purged", targetType: "session", targetId: session.id });
      await db.from("sessions").delete().eq("id", session.id);
    }
    await db.from("rate_limit_counters").delete().lt("expires_at", now.toISOString());
    return NextResponse.json({ archived: (revealed.data?.length ?? 0) + (abandoned.data?.length ?? 0), purged: due.data?.length ?? 0 });
  } catch (error) { return apiError(error); }
}
