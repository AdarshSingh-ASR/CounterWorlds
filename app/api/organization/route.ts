import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { requireMembership, writeAudit } from "../../../lib/access";
import { sql } from "../../../lib/db";
import { apiError } from "../../../lib/http";

async function context(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new Error("Sign in to continue");
  const organizationId = new URL(request.url).searchParams.get("organizationId");
  const member = await requireMembership(session.user.id, organizationId);
  return { session, member };
}

export async function GET(request: Request) {
  try {
    const { member } = await context(request);
    const [members, invitations] = await Promise.all([
      sql<{id:string;user_id:string;name:string;email:string;role:string;created_at:string}>(
        `select m.id, m."userId" as user_id, u.name, u.email, m.role, m."createdAt" as created_at
         from better_auth.member m join better_auth."user" u on u.id=m."userId"
         where m."organizationId"=$1 order by case m.role when 'owner' then 0 when 'admin' then 1 else 2 end, m."createdAt"`, [member.organization_id]),
      sql<{id:string;email:string;role:string;status:string;expires_at:string}>(
        `select id,email,coalesce(role,'member') role,status,"expiresAt" as expires_at
         from better_auth.invitation where "organizationId"=$1 and status='pending' and "expiresAt">now()
         order by "createdAt" desc`, [member.organization_id]),
    ]);
    let classrooms:unknown[]=[];
    if(member.role === "owner" || member.role === "admin"){
      const metadata=await sql(
        `select s.code,s.status,s.owner_user_id,u.name owner_name,s.created_at,s.updated_at,
          (select count(*)::int from public.memberships sm where sm.session_id=s.id) student_count
         from public.sessions s left join better_auth."user" u on u.id=s.owner_user_id
         where s.organization_id=$1 order by s.updated_at desc`,[member.organization_id]);
      classrooms=metadata.rows;
    }
    return NextResponse.json({ members:members.rows, invitations:invitations.rows, classrooms, canManage:member.role === "owner" || member.role === "admin", currentRole:member.role });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const { session, member } = await context(request);
    if (member.role !== "owner" && member.role !== "admin") throw new Error("Only workspace owners and admins can invite teachers");
    const body = await request.json() as { email?:string;role?:string };
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error("Enter the teacher's exact Google account email");
    const role = body.role === "admin" && member.role === "owner" ? "admin" : "member";
    const existing = await sql(`select 1 from better_auth.member m join better_auth."user" u on u.id=m."userId" where m."organizationId"=$1 and lower(u.email)=$2 limit 1`, [member.organization_id,email]);
    if (existing.rowCount) throw new Error("That Google account already belongs to this workspace");
    await sql(`update better_auth.invitation set status='cancelled' where "organizationId"=$1 and lower(email)=$2 and status='pending'`, [member.organization_id,email]);
    const id = crypto.randomUUID();
    await sql(`insert into better_auth.invitation (id,"organizationId",email,role,status,"expiresAt","createdAt","inviterId") values ($1,$2,$3,$4,'pending',now()+interval '7 days',now(),$5)`, [id,member.organization_id,email,role,session.user.id]);
    await writeAudit({ actorUserId:session.user.id, organizationId:member.organization_id, action:"organization.invitation_created", targetType:"invitation", targetId:id, metadata:{ email, role } });
    return NextResponse.json({ invitation:{ id,email,role }, path:`/accept-invitation/${id}` }, { status:201 });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const { session, member } = await context(request);
    if (member.role !== "owner" && member.role !== "admin") throw new Error("Only workspace owners and admins can manage members");
    const body = await request.json() as { memberId?:string;role?:string;invitationId?:string;action?:string };
    if (body.action === "cancel-invitation") {
      await sql(`update better_auth.invitation set status='cancelled' where id=$1 and "organizationId"=$2 and status='pending'`, [body.invitationId,member.organization_id]);
      await writeAudit({ actorUserId:session.user.id, organizationId:member.organization_id, action:"organization.invitation_cancelled", targetType:"invitation", targetId:body.invitationId });
      return NextResponse.json({ ok:true });
    }
    const target = await sql<{user_id:string;role:string}>(`select "userId" user_id,role from better_auth.member where id=$1 and "organizationId"=$2 limit 1`, [body.memberId,member.organization_id]);
    const row = target.rows[0];
    if (!row || row.role === "owner") throw new Error("Workspace owner membership cannot be changed here");
    if (member.role !== "owner") throw new Error("Only the workspace owner can change teacher roles");
    if (body.action === "remove") {
      await sql(`delete from better_auth.member where id=$1 and "organizationId"=$2`, [body.memberId,member.organization_id]);
      await writeAudit({ actorUserId:session.user.id, organizationId:member.organization_id, action:"organization.member_removed", targetType:"user", targetId:row.user_id });
    } else {
      const role = body.role === "admin" ? "admin" : "member";
      await sql(`update better_auth.member set role=$1 where id=$2 and "organizationId"=$3`, [role,body.memberId,member.organization_id]);
      await writeAudit({ actorUserId:session.user.id, organizationId:member.organization_id, action:"organization.role_changed", targetType:"user", targetId:row.user_id, metadata:{ role } });
    }
    return NextResponse.json({ ok:true });
  } catch (error) { return apiError(error); }
}
