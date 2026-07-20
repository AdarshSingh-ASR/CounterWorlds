"use client";

import Link from "next/link";
import { LogOut, Settings, ShieldAlert } from "lucide-react";
import { authClient, useSession } from "../lib/auth-client";

function Mark() { return <span className="signal-mark" aria-hidden="true"><i /><i /><i /></span>; }

export function PortalHeader() {
  const { data } = useSession();
  const impersonatedBy=(data?.session as {impersonatedBy?:string|null}|undefined)?.impersonatedBy;
  async function stopImpersonation(){const response=await fetch("/api/admin/stop-impersonation",{method:"POST"});const payload=await response.json();if(response.ok)location.href=payload.redirect??"/admin";}
  return <>{impersonatedBy&&<div className="impersonation-banner" role="alert"><ShieldAlert/> SUPPORT ACCESS IS ACTIVE · Every action is audited.<button onClick={stopImpersonation}>Stop impersonating</button></div>}<header className="portal-header">
    <Link href="/dashboard" className="signal-logo"><Mark /><span>COUNTERWORLDS</span></Link>
    <nav><span className="portal-user">{data?.user?.name ?? "Teacher"}</span><Link href="/settings"><Settings size={14} /> Settings</Link><button onClick={() => authClient.signOut({ fetchOptions: { onSuccess: () => { location.href = "/"; } } })}><LogOut size={14} /> Sign out</button></nav>
  </header></>;
}
