import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { writeAudit } from "../../../../lib/access";
import { sql } from "../../../../lib/db";
import { apiError } from "../../../../lib/http";

export async function POST(request:Request){
  try{
    const session=await auth.api.getSession({headers:request.headers});
    const actorId=(session?.session as {impersonatedBy?:string|null}|undefined)?.impersonatedBy;
    if(!session||!actorId)throw new Error("No support impersonation is active");
    const actor=await sql<{role:string}>(`select coalesce(role,'user') role from better_auth."user" where id=$1 limit 1`,[actorId]);
    if(actor.rows[0]?.role!=="admin")throw new Error("Support operator access could not be verified");
    await writeAudit({actorUserId:actorId,action:"support.impersonation_stopped",targetType:"user",targetId:session.user.id});
    const result=await auth.api.stopImpersonating({headers:request.headers,returnHeaders:true});
    const response=NextResponse.json({ok:true,redirect:"/admin"});
    result.headers.forEach((value,key)=>response.headers.append(key,value));
    return response;
  }catch(error){return apiError(error);}
}
