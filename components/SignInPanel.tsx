"use client";

import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import { ParticleField } from "./ParticleField";

function Mark(){return <span className="signal-mark" aria-hidden="true"><i/><i/><i/></span>}

export function SignInPanel(){
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  async function continueWithGoogle(){setLoading(true);setError("");const requested=new URLSearchParams(window.location.search).get("returnTo");const callbackURL=requested?.startsWith("/")&&!requested.startsWith("//")?requested:"/dashboard";const result=await authClient.signIn.social({provider:"google",callbackURL,newUserCallbackURL:"/onboarding"});if(result?.error){setError(result.error.message??"Google sign-in could not start");setLoading(false);}}
  return <main className="auth-layout"><section className="auth-visual"><ParticleField/><div><span className="portal-eyebrow">THE TEACHER OBSERVATORY</span><h1>Your classes.<br/>Your evidence.</h1><p>Persistent classroom ownership, real model generation, and a complete history of how student beliefs changed.</p></div></section><section className="auth-panel"><Link href="/" className="signal-logo"><Mark/><span>COUNTERWORLDS</span></Link><h2>Enter the observatory</h2><p>Use your school or professional Google account. Students never need an account.</p><button className="google-button" onClick={continueWithGoogle} disabled={loading}><span className="google-g">G</span>{loading?"Connecting securely…":"Continue with Google"}</button>{error&&<p className="form-error">{error}</p>}<div className="auth-note"><LockKeyhole/><span>Google is the only sign-in method for this pilot. CounterWorlds does not store passwords.</span></div><Link href="/privacy" className="back-link"><ArrowLeft/> Review privacy before continuing</Link></section></main>;
}
