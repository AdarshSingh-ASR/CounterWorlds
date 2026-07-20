"use client";

import Link from "next/link";
import { Archive, ArrowRight, FlaskConical, KeyRound, LoaderCircle, Plus, Trash2, Users, X } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "../lib/auth-client";
import { PortalHeader } from "./PortalHeader";
import { ThemedSelect } from "./ThemedSelect";

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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
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

  async function permanentlyDelete(){
    if(!deleteTarget||deleteConfirmation!==deleteTarget)return;
    setDeleting(true);setError("");
    const response=await fetch(`/api/classrooms/${deleteTarget}`,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({confirmation:deleteConfirmation})});
    if(!response.ok){const payload=await response.json();setError(payload.error??"Could not permanently delete classroom");setDeleting(false);return;}
    setDeleteTarget(null);setDeleteConfirmation("");setDeleting(false);await load();
  }

  if (loading) return <main className="portal-page"><PortalHeader/><div className="full-loading"><LoaderCircle className="spin"/><b>Opening your observatory…</b></div></main>;
  const active = rooms.filter((room) => room.status !== "archived");
  const archived = rooms.filter((room) => room.status === "archived");

  return <main className="portal-page"><PortalHeader/><div className="portal-content">
    <div className="dashboard-head"><div><span className="portal-eyebrow">{profile?.membership?.name?.toUpperCase()}</span><h1 className="portal-title">Welcome back,<br/>{profile?.profile?.display_name?.split(" ")[0]}.</h1><p className="portal-subtitle">Every number below comes from a real classroom record.</p></div></div>
    {error && <p className="form-error">{error}</p>}
    <form className="portal-form glass-panel" onSubmit={create} style={{padding:24,marginBottom:38}}>
      <div className="form-grid"><label>STEM domain<ThemedSelect ariaLabel="STEM domain" value={lesson.domain} onChange={(domain)=>setLesson({...lesson,domain})} options={["Physics","Mathematics","Chemistry","Biology"].map((value)=>({value,label:value}))}/></label><label>AI compiler<ThemedSelect ariaLabel="AI compiler" value={lesson.aiProvider} onChange={(aiProvider)=>setLesson({...lesson,aiProvider,credentialId:aiProvider==="openai"?(lesson.credentialId||credentials[0]?.id||""):""})} options={[{value:"vertex-gemini",label:"Gemini 2.5 Flash · platform"},{value:"openai",label:"GPT-5.6 Sol · your key",disabled:!credentials.length}]}/></label></div>
      {lesson.aiProvider === "openai" && <label>Verified OpenAI key<ThemedSelect ariaLabel="Verified OpenAI key" value={lesson.credentialId} onChange={(credentialId)=>setLesson({...lesson,credentialId})} options={credentials.map((credential)=>({value:credential.id,label:`${credential.scope === "personal" ? "Personal" : "Workspace"} ·••••${credential.last_four}`}))}/></label>}
      {!credentials.length && <p className="field-help"><KeyRound size={14}/> OpenAI is available after you <Link href="/settings">save a verified API key</Link>. Gemini remains the platform-funded default.</p>}
      <label>Question<input required minLength={10} value={lesson.question} onChange={(event)=>setLesson({...lesson,question:event.target.value})} placeholder="What law do you want students to make visible?"/></label>
      <div className="form-grid"><label>Learning objective<textarea required minLength={10} rows={3} value={lesson.learningObjective} onChange={(event)=>setLesson({...lesson,learningObjective:event.target.value})}/></label><label>Canonical model<textarea required minLength={10} rows={3} value={lesson.canonicalModel} onChange={(event)=>setLesson({...lesson,canonicalModel:event.target.value})}/></label></div>
      <button className="portal-button" disabled={creating}>{creating?<LoaderCircle className="spin"/>:<Plus/>} Create live classroom</button>
    </form>
    <span className="portal-eyebrow">ACTIVE CLASSROOMS · {active.length}</span>
    {active.length ? <div className="dashboard-grid" style={{marginTop:16}}>{active.map((room)=><article className="classroom-card glass-panel" key={room.id}><div className="classroom-card-top"><span>{room.code}</span><b className="classroom-status">{room.status}</b></div><h3>{room.question}</h3><p>{room.domain} · {room.ai_provider === "openai" ? "GPT-5.6 Sol" : "Gemini 2.5 Flash"}</p><div className="classroom-metrics"><span><b>{room.students}</b>students</span><span><b>{room.responses}</b>beliefs</span><span><b>{room.revisions}</b>revisions</span></div><div className="classroom-card-actions"><Link href={`/teacher/${room.code}`} className="portal-button">Open <ArrowRight/></Link><button className="portal-button secondary" onClick={()=>archive(room.code,"archive")} type="button"><Archive/> Archive</button></div></article>)}</div> : <div className="empty-dashboard glass-panel"><FlaskConical/><h2>No classroom evidence yet.</h2><p>Create the first question above. Nothing is pre-seeded.</p></div>}
    {archived.length > 0 && <><span className="portal-eyebrow" style={{display:"block",marginTop:50}}>ARCHIVED · {archived.length}</span><div className="dashboard-grid" style={{marginTop:16}}>{archived.map((room)=><article className="classroom-card glass-panel" key={room.id}><div className="classroom-card-top"><span>{room.code}</span><b className="classroom-status">PURGES IN 90 DAYS</b></div><h3>{room.question}</h3><p>{room.domain}</p><div className="classroom-metrics"><span><b>{room.students}</b><Users/> students</span><span><b>{room.changed}</b>model shifts</span></div><div className="classroom-card-actions"><button className="portal-button secondary" type="button" onClick={()=>archive(room.code,"restore")}>Restore classroom</button><button className="portal-button danger" type="button" onClick={()=>{setDeleteTarget(room.code);setDeleteConfirmation("");setError("");}}><Trash2/> Delete forever</button></div></article>)}</div></>}
    {deleteTarget&&<div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-classroom-title"><div className="create-modal glass-panel"><button className="modal-close" type="button" aria-label="Close deletion dialog" onClick={()=>{if(!deleting){setDeleteTarget(null);setDeleteConfirmation("");}}}><X/></button><span className="portal-eyebrow">IRREVERSIBLE ACTION</span><h2 id="delete-classroom-title">Delete classroom forever?</h2><p className="portal-subtitle">This immediately removes every classroom record and its generated world artifact. Type <b>{deleteTarget}</b> to confirm.</p><label>Classroom code<input autoFocus autoComplete="off" value={deleteConfirmation} onChange={(event)=>setDeleteConfirmation(event.target.value.toUpperCase())} placeholder={deleteTarget}/></label><div className="classroom-card-actions"><button className="portal-button secondary" type="button" disabled={deleting} onClick={()=>{setDeleteTarget(null);setDeleteConfirmation("");}}>Cancel</button><button className="portal-button danger" type="button" disabled={deleteConfirmation!==deleteTarget||deleting} onClick={permanentlyDelete}>{deleting?<LoaderCircle className="spin"/>:<Trash2/>}{deleting?"Deleting…":"Delete permanently"}</button></div></div></div>}
  </div></main>;
}
