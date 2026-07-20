import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { writeAudit } from "../../../lib/access";
import { isPlatformAdmin } from "../../../lib/auth-server";
import { sql } from "../../../lib/db";
import { apiError } from "../../../lib/http";
import { getSupabaseAdmin } from "../../../lib/supabase-server";

async function operator(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !isPlatformAdmin(session.user)) throw new Error("Platform operator access is required");
  if (!session.user.twoFactorEnabled) throw new Error("Enroll a TOTP authenticator before using support tools");
  const grant = await getSupabaseAdmin().from("mfa_session_grants").select("expires_at").eq("session_id", session.session.id).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (grant.error) throw new Error(grant.error.message);
  if (!grant.data) throw new Error("A fresh TOTP verification is required");
  return session;
}

export async function GET(request: Request) {
  try {
    await operator(request);
    const users = await sql<{ id:string;name:string;email:string;role:string;banned:boolean;created_at:string;two_factor:boolean }>(`select id,name,email,coalesce(role,'user') role,coalesce(banned,false) banned,"createdAt" as created_at,coalesce("twoFactorEnabled",false) two_factor from better_auth."user" order by "createdAt" desc limit 100`);
    const organizations = await sql<{id:string;name:string;slug:string;created_at:string;members:number}>(`select o.id,o.name,o.slug,o."createdAt" as created_at,count(m.id)::int members from better_auth.organization o left join better_auth.member m on m."organizationId"=o.id group by o.id order by o."createdAt" desc limit 100`);
    const classrooms = await getSupabaseAdmin().from("sessions").select("id,code,organization_id,owner_user_id,status,domain,created_at,updated_at").order("created_at",{ascending:false}).limit(100);
    if (classrooms.error) throw new Error(classrooms.error.message);
    return NextResponse.json({ users: users.rows, organizations: organizations.rows, classrooms: classrooms.data ?? [] });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const current = await operator(request);
    const body = await request.json() as { action?:string;userId?:string;reason?:string };
    const target = body.userId ? await sql<{id:string;role:string;email:string}>(`select id,coalesce(role,'user') role,email from better_auth."user" where id=$1 limit 1`,[body.userId]) : null;
    const user = target?.rows[0];
    if (!user) throw new Error("Target user was not found");
    if (user.role === "admin" && body.action === "impersonate") throw new Error("Operators cannot impersonate another operator");
    if (body.action === "ban") await auth.api.banUser({ body: { userId: user.id, banReason: String(body.reason ?? "Policy or security review").slice(0,300) }, headers: request.headers });
    else if (body.action === "unban") await auth.api.unbanUser({ body: { userId: user.id }, headers: request.headers });
    else if (body.action === "revoke") await auth.api.revokeUserSessions({ body: { userId: user.id }, headers: request.headers });
    else if (body.action === "impersonate") {
      const reason=String(body.reason??"").trim();if(reason.length<20)throw new Error("A support-access reason of at least 20 characters is required");
      await writeAudit({actorUserId:current.user.id,action:"support.impersonation_started",targetType:"user",targetId:user.id,reason});
      const result = await auth.api.impersonateUser({ body: { userId: user.id }, headers: request.headers, returnHeaders: true });
      const response = NextResponse.json({ ok:true,redirect:"/dashboard" });
      result.headers.forEach((value,key)=>response.headers.append(key,value));
      return response;
    } else throw new Error("Unknown support action");
    await writeAudit({ actorUserId: current.user.id, action: `support.${body.action}`, targetType: "user", targetId: user.id, reason: String(body.reason ?? "") || null });
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
