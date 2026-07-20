"use client";

import Link from "next/link";
import { Archive, ArrowRight, FlaskConical, KeyRound, LoaderCircle, Plus, Trash2, Users } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/auth-client";
import { PortalHeader } from "./PortalHeader";

type ProfilePayload = {
  profile: { display_name: string } | null;
  membership: { organization_id: string; name: string; role: string } | null;
  organizationSettings: { default_ai_provider: string } | null;
};
type Classroom = { id:string;code:string;question:string;learning_objective:string;domain:string;status:string;ai_provider:string;created_at:string;archived_at:string|null;students:number;responses:number;revisions:number;changed:number };
type Credential = { id:string;scope:"personal"|"organization";last_four:string };

export function Dashboard() {
  const router = useRouter();
  const { data, isPending } = useSession();
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [rooms, setRooms] = useState<Classroom[]>([]);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [lesson, setLesson] = useState({ question:"", learningObjective:"", canonicalModel:"", domain:"Physics", aiProvider:"vertex-gemini", credentialId:"" });

  const load = useCallback(async () => {
    try {
      const [profileResponse, classroomResponse] = await Promise.all([fetch("/api/profile"), fetch("/api/classrooms")]);
      if (profileResponse.status === 401 || classroomResponse.status === 401) { router.replace("/sign-in"); return; }
      const nextProfile = await profileResponse.json() as ProfilePayload;
      const classroomPayload = await classroomResponse.json() as { classrooms?:Classroom[];error?:string };
      if (!nextProfile.profile || !nextProfile.membership) { router.replace("/onboarding"); return; }
      const credentialResponse = await fetch(`/api/settings/ai?organizationId=${nextProfile.membership.organization_id}`);
      const credentialPayload = credentialResponse.ok
        ? await credentialResponse.json() as { personal?:Credential[];shared?:Credential[] }
        : { personal: [], shared: [] };
      const available = [...(credentialPayload.personal ?? []), ...(credentialPayload.shared ?? [])];
      const defaultProvider = nextProfile.organizationSettings?.default_ai_provider === "openai" && available.length ? "openai" : "vertex-gemini";
      setProfile(nextProfile);
      setCredentials(available);
      setLesson((current) => ({ ...current, aiProvider:defaultProvider, credentialId:defaultProvider === "openai" ? (current.credentialId || available[0]?.id || "") : "" }));
      setRooms(classroomPayload.classrooms ?? []);
      setLoading(false);
    } catch {
      setError("Could not load your classroom history");
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { if (!isPending && !data) { router.replace("/sign-in"); return; } if (data) Promise.resolve().then(load); }, [data, isPending, load, router]);
  useEffect(() => {
    if (!profile?.membership) return;
    const legacy = Object.keys(sessionStorage).filter((key) => key.startsWith("cw-teacher-"));
    if (!legacy.length) return;
    Promise.all(legacy.map(async (key) => {
      const code = key.slice("cw-teacher-".length);
      const token = sessionStorage.getItem(key);
      if (!token) return;
      const response = await fetch("/api/classrooms/claim", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ code, token, organizationId:profile.membership?.organization_id }) });
      if (response.ok) sessionStorage.removeItem(key);
    })).then(() => load());
  }, [profile?.membership, load]);

  async function create(event:FormEvent) {
    event.preventDefault();
    if (!profile?.membership) return;
    if (lesson.aiProvider === "openai" && !lesson.credentialId) { setError("Save and select a verified OpenAI key, or use Gemini."); return; }
    setCreating(true); setError("");
    try {
      const response = await fetch("/api/classrooms", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({ ...lesson, organizationId:profile.membership.organization_id }) });
      const payload = await response.json() as { code?:string;error?:string };
      if (!response.ok || !payload.code) throw new Error(payload.error ?? "Could not create classroom");
      router.push(`/teacher/${payload.code}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create classroom");
      setCreating(false);
    }
  }

  async function archive(code:string, action:"archive"|"restore") {
    const response = await fetch(`/api/classrooms/${code}`, { method:"PATCH", headers:{"content-type":"application/json"}, body:JSON.stringify({ action }) });
    if (!response.ok) { const payload = await response.json(); setError(payload.error ?? "Could not update classroom"); return; }
    load();
  }

  async function permanentlyDelete(code:string){
    const confirmation=window.prompt(`Permanent deletion removes all classroom records and generated artifacts. Type ${code} to continue.`);
    if(confirmation!==code)return;
    const response=await fetch(`/api/classrooms/${code}`,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({confirmation})});
    if(!response.ok){const payload=await response.json();setError(payload.error??"Could not permanently delete classroom");return;}
    load();
  }

  if (loading) return <main className="portal-page"><PortalHeader/><div className="full-loading"><LoaderCircle className="spin"/><b>Opening your observatory…</b></div></main>;
  const active = rooms.filter((room) => room.status !== "archived");
  const archived = rooms.filter((room) => room.status === "archived");

  return <main className="portal-page"><PortalHeader/><div className="portal-content">
    <div className="dashboard-head"><div><span className="portal-eyebrow">{profile?.membership?.name?.toUpperCase()}</span><h1 className="portal-title">Welcome back,<br/>{profile?.profile?.display_name?.split(" ")[0]}.</h1><p className="portal-subtitle">Every number below comes from a real classroom record.</p></div></div>
    {error && <p className="form-error">{error}</p>}
    <form className="portal-form glass-panel" onSubmit={create} style={{padding:24,marginBottom:38}}>
      <div className="form-grid"><label>STEM domain<select value={lesson.domain} onChange={(event)=>setLesson({...lesson,domain:event.target.value})}><option>Physics</option><option>Mathematics</option><option>Chemistry</option><option>Biology</option></select></label><label>AI compiler<select value={lesson.aiProvider} onChange={(event)=>{const aiProvider=event.target.value;setLesson({...lesson,aiProvider,credentialId:aiProvider==="openai"?(lesson.credentialId||credentials[0]?.id||""):""})}}><option value="vertex-gemini">Gemini 2.5 Flash · platform</option><option value="openai" disabled={!credentials.length}>GPT-5.6 Sol · your key</option></select></label></div>
      {lesson.aiProvider === "openai" && <label>Verified OpenAI key<select required value={lesson.credentialId} onChange={(event)=>setLesson({...lesson,credentialId:event.target.value})}>{credentials.map((credential)=><option value={credential.id} key={credential.id}>{credential.scope === "personal" ? "Personal" : "Workspace"} ·••••{credential.last_four}</option>)}</select></label>}
      {!credentials.length && <p className="field-help"><KeyRound size={14}/> OpenAI is available after you <Link href="/settings">save a verified API key</Link>. Gemini remains the platform-funded default.</p>}
      <label>Question<input required minLength={10} value={lesson.question} onChange={(event)=>setLesson({...lesson,question:event.target.value})} placeholder="What law do you want students to make visible?"/></label>
      <div className="form-grid"><label>Learning objective<textarea required minLength={10} rows={3} value={lesson.learningObjective} onChange={(event)=>setLesson({...lesson,learningObjective:event.target.value})}/></label><label>Canonical model<textarea required minLength={10} rows={3} value={lesson.canonicalModel} onChange={(event)=>setLesson({...lesson,canonicalModel:event.target.value})}/></label></div>
      <button className="portal-button" disabled={creating}>{creating?<LoaderCircle className="spin"/>:<Plus/>} Create live classroom</button>
    </form>
    <span className="portal-eyebrow">ACTIVE CLASSROOMS · {active.length}</span>
    {active.length ? <div className="dashboard-grid" style={{marginTop:16}}>{active.map((room)=><article className="classroom-card glass-panel" key={room.id}><div className="classroom-card-top"><span>{room.code}</span><b className="classroom-status">{room.status}</b></div><h3>{room.question}</h3><p>{room.domain} · {room.ai_provider === "openai" ? "GPT-5.6 Sol" : "Gemini 2.5 Flash"}</p><div className="classroom-metrics"><span><b>{room.students}</b>students</span><span><b>{room.responses}</b>beliefs</span><span><b>{room.revisions}</b>revisions</span></div><div className="classroom-card-actions"><Link href={`/teacher/${room.code}`} className="portal-button">Open <ArrowRight/></Link><button className="portal-button secondary" onClick={()=>archive(room.code,"archive")} type="button"><Archive/> Archive</button></div></article>)}</div> : <div className="empty-dashboard glass-panel"><FlaskConical/><h2>No classroom evidence yet.</h2><p>Create the first question above. Nothing is pre-seeded.</p></div>}
    {archived.length > 0 && <><span className="portal-eyebrow" style={{display:"block",marginTop:50}}>ARCHIVED · {archived.length}</span><div className="dashboard-grid" style={{marginTop:16}}>{archived.map((room)=><article className="classroom-card glass-panel" key={room.id}><div className="classroom-card-top"><span>{room.code}</span><b className="classroom-status">PURGES IN 90 DAYS</b></div><h3>{room.question}</h3><p>{room.domain}</p><div className="classroom-metrics"><span><b>{room.students}</b><Users/> students</span><span><b>{room.changed}</b>model shifts</span></div><div className="classroom-card-actions"><button className="portal-button secondary" type="button" onClick={()=>archive(room.code,"restore")}>Restore classroom</button><button className="portal-button danger" type="button" onClick={()=>permanentlyDelete(room.code)}><Trash2/> Delete forever</button></div></article>)}</div></>}
  </div></main>;
}
