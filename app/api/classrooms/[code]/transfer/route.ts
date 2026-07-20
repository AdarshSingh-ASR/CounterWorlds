import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { getMembership, writeAudit } from "../../../../../lib/access";
import { sql } from "../../../../../lib/db";
import { apiError } from "../../../../../lib/http";
import { getSupabaseAdmin } from "../../../../../lib/supabase-server";

export async function POST(request:Request,{params}:{params:Promise<{code:string}>}){
  try{
    const session=await auth.api.getSession({headers:request.headers});if(!session)throw new Error("Sign in to continue");
    const code=(await params).code.toUpperCase();const body=await request.json() as {targetUserId?:string};
    const classroom=await getSupabaseAdmin().from("sessions").select("id,organization_id,owner_user_id").eq("code",code).maybeSingle();
    if(classroom.error)throw new Error(classroom.error.message);if(!classroom.data?.organization_id)throw new Error("Classroom access could not be verified");
    const actor=await getMembership(session.user.id,classroom.data.organization_id);if(!actor)throw new Error("Classroom access could not be verified");
    if(classroom.data.owner_user_id!==session.user.id&&actor.role!=="owner"&&actor.role!=="admin")throw new Error("Only the classroom teacher or a workspace administrator can transfer ownership");
    const target=await sql<{user_id:string}>(`select "userId" user_id from better_auth.member where "organizationId"=$1 and "userId"=$2 limit 1`,[classroom.data.organization_id,body.targetUserId]);
    if(!target.rows[0])throw new Error("Select a teacher in this workspace");
    const previousOwner=classroom.data.owner_user_id;
    const updated=await getSupabaseAdmin().from("sessions").update({owner_user_id:body.targetUserId,updated_at:new Date().toISOString()}).eq("id",classroom.data.id);
    if(updated.error)throw new Error(updated.error.message);
    await writeAudit({actorUserId:session.user.id,organizationId:classroom.data.organization_id,action:"classroom.ownership_transferred",targetType:"session",targetId:classroom.data.id,metadata:{previousOwner,newOwner:body.targetUserId}});
    return NextResponse.json({ok:true});
  }catch(error){return apiError(error);}
}
