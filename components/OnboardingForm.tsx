"use client";

import { ArrowRight, LoaderCircle, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { authClient, useSession } from "../lib/auth-client";
import { PortalHeader } from "./PortalHeader";

export function OnboardingForm() {
  const router = useRouter();
  const { data, isPending } = useSession();
  const [form, setForm] = useState({ displayName: "", title: "Teacher", schoolName: "", schoolType: "secondary-school", country: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, subjects: "Physics, Mathematics", gradeBands: "9, 10, 11, 12", authority: false });
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  useEffect(() => { if (!isPending && !data) router.replace("/sign-in"); }, [data, isPending, router]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const slug = `${form.schoolName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36) || "school"}-${crypto.randomUUID().slice(0, 6)}`;
      const created = await authClient.organization.create({ name: form.schoolName.trim(), slug });
      if (created.error || !created.data) throw new Error(created.error?.message ?? "Could not create the school workspace");
      await authClient.organization.setActive({ organizationId: created.data.id });
      const response = await fetch("/api/profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        organizationId: created.data.id, displayName: form.displayName, title: form.title, schoolType: form.schoolType, country: form.country, timezone: form.timezone,
        subjects: form.subjects.split(",").map((item) => item.trim()).filter(Boolean), gradeBands: form.gradeBands.split(",").map((item) => item.trim()).filter(Boolean), schoolAuthorityConfirmed: form.authority,
      }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not finish onboarding");
      router.replace("/dashboard"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Onboarding failed"); setBusy(false); }
  }
  return <main className="portal-page"><PortalHeader /><div className="portal-content" style={{maxWidth:850}}><span className="portal-eyebrow">SET UP YOUR OBSERVATORY</span><h1 className="portal-title">One teacher.<br />One school workspace.</h1><p className="portal-subtitle">This establishes persistent ownership for every classroom you create. You can invite colleagues after setup.</p><form className="portal-form glass-panel" onSubmit={submit} style={{padding:28,marginTop:36}}><div className="form-grid"><label>Your display name<input required value={form.displayName} onChange={(e)=>setForm({...form,displayName:e.target.value})} /></label><label>Role or title<input required value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} /></label></div><label>School or learning organization<input required minLength={2} value={form.schoolName} onChange={(e)=>setForm({...form,schoolName:e.target.value})} placeholder="e.g. Horizon Secondary School" /></label><div className="form-grid"><label>School type<select value={form.schoolType} onChange={(e)=>setForm({...form,schoolType:e.target.value})}><option value="secondary-school">Secondary school</option><option value="higher-secondary">Higher secondary</option><option value="tutoring-program">Tutoring program</option><option value="other">Other</option></select></label><label>Country<input required value={form.country} onChange={(e)=>setForm({...form,country:e.target.value})} /></label></div><div className="form-grid"><label>Subjects<input value={form.subjects} onChange={(e)=>setForm({...form,subjects:e.target.value})} /></label><label>Grade bands<input value={form.gradeBands} onChange={(e)=>setForm({...form,gradeBands:e.target.value})} /></label></div><label>Timezone<input value={form.timezone} onChange={(e)=>setForm({...form,timezone:e.target.value})} /></label><label className="check-row"><input type="checkbox" checked={form.authority} onChange={(e)=>setForm({...form,authority:e.target.checked})} /><span><b>I am authorized by this school or learning organization.</b><br />I will use CounterWorlds only with learners aged 13 or older and will not ask students to enter personal information.</span></label>{error && <p className="form-error">{error}</p>}<button className="portal-button" disabled={busy || !form.authority}>{busy ? <LoaderCircle className="spin" /> : <ShieldCheck />} Create secure workspace <ArrowRight /></button></form></div></main>;
}
