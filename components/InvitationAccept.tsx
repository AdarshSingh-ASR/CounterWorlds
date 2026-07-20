"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "../lib/auth-client";
import { PortalHeader } from "./PortalHeader";

export function InvitationAccept(){
  const {id}=useParams<{id:string}>();const router=useRouter();const {data,isPending}=useSession();const [invitation,setInvitation]=useState<{organizationName:string;email:string;role:string}|null>(null);const [error,setError]=useState("");const [busy,setBusy]=useState(false);
  useEffect(()=>{if(isPending)return;if(!data){router.replace(`/sign-in?returnTo=${encodeURIComponent(`/accept-invitation/${id}`)}`);return;}fetch(`/api/organization/invitations/${id}`).then(async(response)=>{const payload=await response.json();if(!response.ok)throw new Error(payload.error);setInvitation(payload.invitation);}).catch((cause)=>setError(cause.message??"Could not open invitation"));},[data,id,isPending,router]);
  async function accept(){setBusy(true);setError("");const response=await fetch(`/api/organization/invitations/${id}`,{method:"POST"});const payload=await response.json();if(!response.ok){setError(payload.error??"Could not accept invitation");setBusy(false);return;}router.replace("/dashboard");router.refresh();}
  return <main className="portal-page"><PortalHeader/><div className="portal-content" style={{maxWidth:720}}><section className="glass-panel settings-panel"><span className="portal-eyebrow">SCHOOL INVITATION</span>{error?<><h1>This link cannot be accepted.</h1><p className="form-error">{error}</p><Link className="portal-button secondary" href="/dashboard">Return to dashboard</Link></>:invitation?<><h1>Join {invitation.organizationName}</h1><p>You are signed in as <b>{invitation.email}</b>. Accepting adds this Google identity as {invitation.role==="admin"?"an administrator":"a teacher"}.</p><button className="portal-button" onClick={accept} disabled={busy}>{busy?<LoaderCircle className="spin"/>:<ArrowRight/>} Accept invitation</button></>:<div className="full-loading"><LoaderCircle className="spin"/><b>Checking invitation…</b></div>}</section></div></main>;
}
