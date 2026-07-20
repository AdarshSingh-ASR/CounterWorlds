import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { sql } from "../../../../../lib/db";
import { apiError } from "../../../../../lib/http";
import { writeAudit } from "../../../../../lib/access";

export async function GET(request: Request, context:{params:Promise<{id:string}>}) {
  try {
    const session = await auth.api.getSession({ headers:request.headers });
    if (!session) throw new Error("Sign in with the invited Google account to continue");
    const { id } = await context.params;
    const result = await sql<{id:string;organization_id:string;organization_name:string;email:string;role:string;status:string;expires_at:string}>(
      `select i.id,i."organizationId" organization_id,o.name organization_name,i.email,coalesce(i.role,'member') role,i.status,i."expiresAt" expires_at
       from better_auth.invitation i join better_auth.organization o on o.id=i."organizationId" where i.id=$1 limit 1`, [id]);
    const invitation = result.rows[0];
    if (!invitation || invitation.status !== "pending" || new Date(invitation.expires_at) <= new Date()) throw new Error("This invitation is invalid or has expired");
    if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) throw new Error(`This invitation is for ${invitation.email}. Sign in with that exact Google account.`);
    return NextResponse.json({ invitation:{ organizationName:invitation.organization_name, email:invitation.email, role:invitation.role } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request, context:{params:Promise<{id:string}>}) {
  try {
    const session = await auth.api.getSession({ headers:request.headers });
    if (!session) throw new Error("Sign in with the invited Google account to continue");
    const { id } = await context.params;
    const result = await sql<{organization_id:string;email:string;role:string}>(
      `select "organizationId" organization_id,email,coalesce(role,'member') role from better_auth.invitation
       where id=$1 and status='pending' and "expiresAt">now() limit 1`, [id]);
    const invitation = result.rows[0];
    if (!invitation || invitation.email.toLowerCase() !== session.user.email.toLowerCase()) throw new Error("This invitation is invalid, expired, or belongs to another Google account");
    await sql(
      `with accepted as (
         update better_auth.invitation set status='accepted' where id=$1 and status='pending' and "expiresAt">now() returning "organizationId",role
       ) insert into better_auth.member (id,"organizationId","userId",role,"createdAt")
       select $2,"organizationId",$3,coalesce(role,'member'),now() from accepted
       on conflict ("organizationId","userId") do nothing`, [id,crypto.randomUUID(),session.user.id]);
    await writeAudit({ actorUserId:session.user.id, organizationId:invitation.organization_id, action:"organization.invitation_accepted", targetType:"invitation", targetId:id });
    return NextResponse.json({ ok:true });
  } catch (error) { return apiError(error); }
}
