"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, ArrowRight, BarChart3, BookOpen, BrainCircuit, Check, ChevronRight, CircleDot,
  Clipboard, FlaskConical, Gauge, GraduationCap, Layers3, LoaderCircle, LockKeyhole,
  Menu, Orbit, Play, Plus, Radio, Send, Sparkles, Telescope, Users, WandSparkles, X,
} from "lucide-react";
import { Brand } from "./Brand";
import { WorldLab } from "./WorldLab";
import { REFERENCE_WORLDS, type ClassroomState } from "../lib/counterworlds";

type Mode = "landing" | "teacher" | "student" | "showcase";
type Props = { mode: Mode; initialCode?: string; showcaseSlug?: string };

const defaultLesson = {
  question: "Two carts—1 kg and 4 kg—are pushed with the same constant force. Which accelerates more, and why?",
  learningObjective: "Use evidence to relate force, mass, and acceleration.",
  canonicalModel: "Newton's second law gives a = F/m. For the same force, the lower-mass cart accelerates more.",
  domain: "Physics",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function Shell({ children, minimal = false }: { children: React.ReactNode; minimal?: boolean }) {
  return (
    <main className="site-shell">
      <div className="star-field" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
      {!minimal && <header className="topbar">
        <Brand />
        <nav aria-label="Main navigation"><a href="#how">How it works</a><a href="#worlds">World library</a><Link href="/teacher/ORBIT7">Teacher demo</Link></nav>
        <div className="top-actions">
          <Link className="text-button" href="/join/ORBIT7"><Radio size={14} /> Join ORBIT7</Link>
          <span className="status-pill"><span /> SYSTEM ONLINE</span>
          <button className="mobile-menu" aria-label="Open navigation"><Menu /></button>
        </div>
      </header>}
      {children}
    </main>
  );
}

function Landing() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("ORBIT7");
  const [showCreate, setShowCreate] = useState(false);
  const [lesson, setLesson] = useState(defaultLesson);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function createClass() {
    setCreating(true); setError("");
    try {
      const result = await api<{ code: string; teacherToken: string }>("/api/classroom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", ...lesson }) });
      sessionStorage.setItem(`cw-teacher-${result.code}`, result.teacherToken);
      router.push(`/teacher/${result.code}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create classroom"); setCreating(false); }
  }

  return (
    <Shell>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow hero-eyebrow"><Sparkles size={13} /> A NEW MEDIUM FOR LEARNING</span>
          <h1>Don&apos;t correct the<br />wrong answer.<br /><em>Build its universe.</em></h1>
          <p>CounterWorlds turns a class&apos;s misconceptions into playable experiments—so students discover which laws survive contact with evidence.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={17} /> Launch a classroom <ArrowRight size={17} /></button>
            <Link className="secondary-button" href="/teacher/ORBIT7"><Play size={16} /> Watch the 90-sec demo</Link>
          </div>
          <div className="join-inline">
            <span>STUDENT?</span><input aria-label="Classroom code" value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} /><button onClick={() => router.push(`/join/${joinCode || "ORBIT7"}`)}>Enter portal <ChevronRight size={15} /></button>
          </div>
          <div className="trust-row"><span><LockKeyhole size={14} /> Anonymous by design</span><span><BrainCircuit size={14} /> Productive struggle</span><span><Sparkles size={14} /> GPT-5.6 Sol</span></div>
        </div>
        <div className="hero-visual" aria-label="Preview of a CounterWorld experiment">
          <div className="hero-orbit hero-orbit-one" /><div className="hero-orbit hero-orbit-two" />
          <div className="visual-topline"><span><Radio size={13} /> LIVE CLASS · 24 BELIEFS</span><b>GENERATING CONTRAST</b></div>
          <div className="visual-question">Same force. Different mass.<br /><b>What happens next?</b></div>
          <div className="mini-worlds">
            <div className="mini-world mini-world-a"><span>WORLD A</span><div className="mini-track"><i /><i className="heavy" /></div><small>Mass amplifies force</small></div>
            <div className="world-divider"><span>VS</span></div>
            <div className="mini-world mini-world-b"><span>WORLD B</span><div className="mini-track"><i /><i className="heavy" /></div><small>Mass resists acceleration</small></div>
          </div>
          <div className="belief-signal"><span className="signal-orb"><Orbit /></span><div><b>Dominant class belief detected</b><p>“Heavier objects accelerate faster.”</p></div><strong>62%</strong></div>
          <div className="compile-strip"><span><LoaderCircle /> Compiling a falsifiable world…</span><div><i /><i /><i /><i /></div></div>
        </div>
      </section>

      <section className="impact-strip" id="how">
        <div><strong>30 sec</strong><span>from belief to evidence</span></div><i /><div><strong>2 worlds</strong><span>one misconception, one model</span></div><i /><div><strong>0 answers</strong><span>given before prediction</span></div><i /><div><strong>1 class</strong><span>thinking visibly, together</span></div>
      </section>

      <section className="process-section">
        <div className="section-heading"><span className="eyebrow"><Telescope size={13} /> THE LEARNING LOOP</span><h2>From invisible belief<br />to visible evidence.</h2><p>Most tools tell teachers who is wrong. CounterWorlds reveals the law students are actually using—and lets them test it.</p></div>
        <div className="process-grid">
          {[
            ["01", BrainCircuit, "Capture the mental model", "Students explain before AI speaks. Every answer becomes evidence of how they think."],
            ["02", Orbit, "Map competing universes", "GPT-5.6 clusters the class into coherent world models—not red and green scores."],
            ["03", WandSparkles, "Compile the counterfactual", "Codex writes a safe, interactive experiment where the dominant misconception is true."],
            ["04", FlaskConical, "Let evidence do the teaching", "Students predict, manipulate both worlds, and revise only after the reveal."],
          ].map(([number, Icon, title, copy]) => <article key={String(number)} className="process-card"><span className="process-number">{number as string}</span><span className="process-icon"><Icon /></span><h3>{title as string}</h3><p>{copy as string}</p></article>)}
        </div>
      </section>

      <section className="world-library" id="worlds">
        <div className="library-heading"><div><span className="eyebrow"><Layers3 size={13} /> VERIFIED WORLD LIBRARY</span><h2>Three disciplines.<br />One revolutionary mechanic.</h2></div><p>Every world starts with a tempting wrong law, then gives students the controls to break it.</p></div>
        <div className="library-grid">
          {Object.values(REFERENCE_WORLDS).map((world, index) => (
            <Link href={`/showcase/${world.slug}`} className={`library-card library-${index + 1}`} key={world.slug}>
              <span className="library-index">0{index + 1}</span><span className="domain-chip">{world.domain}</span><h3>{world.title}</h3><p>{world.misconceptionLaw}</p><div className="law-comparison"><span>STUDENT LAW</span><i /><span>REAL LAW</span></div><b>Enter this CounterWorld <ArrowRight size={16} /></b>
            </Link>
          ))}
        </div>
      </section>

      <section className="closing-section"><div className="closing-orb"><Orbit /></div><span className="eyebrow"><GraduationCap size={13} /> BUILT FOR THE MOMENT OF DOUBT</span><h2>A wrong answer is not a failure.<br /><em>It&apos;s a world waiting to be tested.</em></h2><button className="primary-button" onClick={() => setShowCreate(true)}>Open your first portal <ArrowRight size={17} /></button></section>
      <footer><Brand compact /><p>Where misconceptions become experiments.</p><span>Built with Codex + GPT-5.6 Sol</span></footer>

      {showCreate && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-title"><div className="create-modal"><button className="modal-close" onClick={() => setShowCreate(false)} aria-label="Close"><X /></button><span className="eyebrow"><Telescope size={13} /> NEW OBSERVATORY SESSION</span><h2 id="create-title">What belief will your class test?</h2><label>Question<textarea rows={3} value={lesson.question} onChange={(event) => setLesson({ ...lesson, question: event.target.value })} /></label><label>Learning objective<input value={lesson.learningObjective} onChange={(event) => setLesson({ ...lesson, learningObjective: event.target.value })} /></label><label>Canonical model<textarea rows={3} value={lesson.canonicalModel} onChange={(event) => setLesson({ ...lesson, canonicalModel: event.target.value })} /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button full-button" onClick={createClass} disabled={creating}>{creating ? <><LoaderCircle className="spin" /> Opening portal…</> : <>Create classroom <ArrowRight size={17} /></>}</button><small>Students join anonymously. You stay in control of every reveal.</small></div></div>}
    </Shell>
  );
}

function AppHeader({ code, role, alias }: { code?: string; role: "Teacher" | "Student" | "Explorer"; alias?: string }) {
  return <header className="app-header"><Brand /><div className="app-session-meta">{code && <span>SESSION <b>{code}</b></span>}<span className="role-chip">{role === "Teacher" ? <Telescope size={13} /> : role === "Student" ? <GraduationCap size={13} /> : <FlaskConical size={13} />}{alias ?? role}</span><Link href="/" aria-label="Exit to home"><X size={17} /></Link></div></header>;
}

function LoadingState({ label = "Opening observatory…" }: { label?: string }) {
  return <div className="full-loading"><span className="loading-orbit"><Orbit /></span><b>{label}</b><p>Aligning competing world models</p></div>;
}

function TeacherConsole({ code }: { code: string }) {
  const [state, setState] = useState<ClassroomState | null>(null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"beliefs" | "world" | "evidence">("beliefs");
  const [copied, setCopied] = useState(false);
  const [localProgress, setLocalProgress] = useState(0);
  const token = typeof window !== "undefined" ? (sessionStorage.getItem(`cw-teacher-${code}`) ?? (code === "ORBIT7" ? "demo-teacher-token" : "")) : "";

  const refresh = useCallback(async () => {
    try { setState(await api<ClassroomState>(`/api/classroom?code=${encodeURIComponent(code)}`, { headers: { "x-counterworlds-teacher-token": token } })); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load classroom"); }
  }, [code, token]);
  useEffect(() => { const start = window.setTimeout(refresh, 0); const id = window.setInterval(refresh, 1800); return () => { clearTimeout(start); clearInterval(id); }; }, [refresh]);

  useEffect(() => {
    if (state?.session.status !== "generating") return;
    const started = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - started;
      setLocalProgress(Math.min(92, 12 + elapsed / 95));
      if (elapsed > 7200 && state.job?.status !== "ready" && state.job?.status !== "fallback") {
        api("/api/classroom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "fallback", code, teacherToken: token }) }).then(refresh).catch(() => undefined);
        window.clearInterval(interval);
      }
    }, 180);
    return () => window.clearInterval(interval);
  }, [state?.session.status, state?.job?.status, code, token, refresh]);

  async function teacherAction(action: string) {
    try {
      if (action === "queue" || action === "reset") setLocalProgress(0);
      if (action === "queue") await api("/api/classroom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "close", code, teacherToken: token }) });
      await api("/api/classroom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, code, teacherToken: token }) });
      if (action === "queue") setActiveTab("world");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed"); }
  }

  if (!state && !error) return <Shell minimal><AppHeader code={code} role="Teacher" /><LoadingState /></Shell>;
  if (!state) return <Shell minimal><AppHeader code={code} role="Teacher" /><div className="error-state"><Telescope /><h1>Observatory unavailable</h1><p>{error}</p><Link href="/">Return home</Link></div></Shell>;
  const total = Math.max(1, state.responses.length);
  const progress = Math.max(state.job?.progress ?? 0, localProgress);
  const changed = state.revisions.filter((revision) => revision.changed).length;

  return (
    <Shell minimal>
      <AppHeader code={code} role="Teacher" />
      <div className="teacher-layout">
        <aside className="teacher-sidebar">
          <span className="sidebar-label">OBSERVATORY</span>
          <button className={activeTab === "beliefs" ? "active" : ""} onClick={() => setActiveTab("beliefs")}><Orbit /> Belief map <b>{state.responses.length}</b></button>
          <button className={activeTab === "world" ? "active" : ""} onClick={() => setActiveTab("world")}><FlaskConical /> CounterWorld {state.session.worldSlug && <span className="ready-dot" />}</button>
          <button className={activeTab === "evidence" ? "active" : ""} onClick={() => setActiveTab("evidence")}><BarChart3 /> Evidence <b>{state.predictions.length}</b></button>
          <div className="sidebar-spacer" />
          <div className="join-code-card"><span>STUDENT JOIN CODE</span><strong>{code}</strong><button onClick={() => { navigator.clipboard?.writeText(`${location.origin}/join/${code}`); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>{copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Copy invite"}</button></div>
          <div className="privacy-note"><LockKeyhole /><p><b>No student accounts.</b><br />Aliases disappear with the session.</p></div>
        </aside>
        <section className="teacher-main">
          <div className="teacher-titlebar"><div><span className="eyebrow"><Radio size={13} /> LIVE · {state.session.domain.toUpperCase()}</span><h1>{state.session.question}</h1><p>{state.session.learningObjective}</p></div><div className="session-actions"><span className={`session-status status-${state.session.status}`}><i />{state.session.status.replace("-", " ")}</span>{code === "ORBIT7" && state.session.status !== "collecting" && <button className="demo-reset" onClick={() => teacherAction("reset")}>Reset demo</button>}{state.session.status === "collecting" && <button className="primary-button" onClick={() => teacherAction("queue")}><WandSparkles size={16} /> Compile CounterWorld</button>}{state.session.status === "world-ready" && <button className="primary-button" onClick={() => teacherAction("launch")}><Play size={16} /> Launch to class</button>}{state.session.status === "launched" && <button className="primary-button" onClick={() => teacherAction("reveal")}><Sparkles size={16} /> Reveal evidence</button>}</div></div>
          {error && <div className="inline-error">{error}</div>}

          {activeTab === "beliefs" && <div className="belief-view">
            <div className="view-intro"><div><h2>Competing world models</h2><p>Each constellation is a shared causal belief—not a score.</p></div><div className="live-count"><span><Users /> {state.responses.length}</span> explanations received</div></div>
            <div className="constellation-map">
              <div className="constellation-grid" />
              {state.clusters.map((cluster, index) => {
                const size = 126 + (cluster.count / total) * 130;
                return <div key={cluster.key} className={`belief-orb belief-${cluster.color} belief-position-${index}`} style={{ width: size, height: size }}><span className="orb-rings" /><strong>{Math.round(cluster.count / total * 100)}%</strong><b>{cluster.label}</b><small>{cluster.count} students</small></div>;
              })}
              <div className="map-legend"><span><i className="legend-violet" /> Dominant misconception</span><span><i className="legend-cyan" /> Canonical model</span><span><i className="legend-amber" /> Unresolved</span></div>
            </div>
            <div className="response-stream"><div className="response-heading"><h3>Belief signals</h3><span>ANONYMIZED · LIVE</span></div>{state.responses.slice(-6).map((response) => <article key={response.id}><span className={`avatar avatar-${response.clusterKey}`}>{response.alias.split(" ").map((word) => word[0]).join("")}</span><div><b>{response.alias}</b><p>“{response.answer}”</p></div><span className="response-cluster">{state.clusters.find((cluster) => cluster.key === response.clusterKey)?.label ?? "Unresolved"}</span></article>)}</div>
          </div>}

          {activeTab === "world" && <div className="world-view">
            {state.session.status === "generating" ? <div className="generation-stage"><span className="generation-core"><BrainCircuit /></span><span className="eyebrow"><Sparkles size={13} /> GPT-5.6 SOL · CODEX WORKER</span><h2>Compiling the class&apos;s<br />counterfactual universe</h2><p>{state.job?.stage ?? (progress < 35 ? "Mapping competing mental models" : progress < 65 ? "Writing universe laws" : "Validating the evidence loop")}</p><div className="generation-progress"><span style={{ width: `${progress}%` }} /></div><div className="generation-steps"><span className="done"><Check /> Analyze</span><i /><span className={progress > 38 ? "done" : "active"}>{progress > 38 ? <Check /> : <LoaderCircle className="spin" />} Generate</span><i /><span className={progress > 72 ? "active" : ""}><CircleDot /> Validate</span><i /><span><Sparkles /> Publish</span></div><small>A verified reference world automatically takes over if live generation exceeds 90 seconds.</small></div> : state.session.worldSlug ? <><div className="world-source-banner"><span><Check /> WORLD VERIFIED</span><p>The mistaken and canonical laws respond to identical controls. Labels stay hidden until the class commits.</p><b>{state.job?.status === "fallback" || !state.job ? "CACHED FALLBACK" : "LIVE GENERATED"}</b></div><WorldLab slug={state.session.worldSlug} revealed={state.session.status === "revealed"} /></> : <div className="empty-world"><WandSparkles /><h2>Ready to compile a misconception</h2><p>Close the belief poll when the class has committed to its reasoning.</p><button className="primary-button" onClick={() => teacherAction("queue")}><WandSparkles /> Compile CounterWorld</button></div>}
          </div>}

          {activeTab === "evidence" && <div className="evidence-view">
            <div className="evidence-hero"><span className="eyebrow"><BarChart3 size={13} /> CONCEPTUAL CHANGE</span><h2>Did the evidence move the model?</h2><p>CounterWorlds measures revision, not compliance.</p></div>
            <div className="evidence-stats"><article><span>Predictions locked</span><strong>{state.predictions.length}</strong><small>before the reveal</small></article><article><span>Matched World B</span><strong>{state.predictions.length ? Math.round(state.predictions.filter((p) => p.selectedWorld === "B").length / state.predictions.length * 100) : 0}%</strong><small>from observed evidence</small></article><article><span>Beliefs revised</span><strong>{state.revisions.length ? Math.round(changed / state.revisions.length * 100) : 0}%</strong><small>{changed} of {state.revisions.length} reflections</small></article></div>
            <div className="revision-table"><div className="response-heading"><h3>Revision trail</h3><span>BEFORE → AFTER</span></div>{state.revisions.length === 0 ? <div className="no-evidence"><Gauge /><p>Revision evidence appears after the reveal.</p></div> : state.revisions.map((revision) => <article key={revision.alias}><span className="avatar">{revision.alias.split(" ").map((w) => w[0]).join("")}</span><div><b>{revision.alias}</b><p><del>{revision.beforeBelief}</del><ArrowRight /><span>{revision.afterBelief}</span></p></div><span className={revision.changed ? "changed-chip" : "held-chip"}>{revision.changed ? "MODEL SHIFT" : "HELD"}</span></article>)}</div>
          </div>}
        </section>
      </div>
    </Shell>
  );
}

function StudentExperience({ code }: { code: string }) {
  const [state, setState] = useState<ClassroomState | null>(null);
  const [alias, setAlias] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [answer, setAnswer] = useState("");
  const [revision, setRevision] = useState("");
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [predicted, setPredicted] = useState<"A" | "B" | null>(null);

  const refresh = useCallback(async () => {
    try { setState(await api<ClassroomState>(`/api/classroom?code=${encodeURIComponent(code)}`, { headers: accessToken ? { "x-counterworlds-student-token": accessToken } : {} })); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load classroom"); }
  }, [code, accessToken]);
  useEffect(() => {
    const start = window.setTimeout(() => {
      const savedAlias = sessionStorage.getItem(`cw-alias-${code}`);
      const savedToken = sessionStorage.getItem(`cw-student-token-${code}`);
      const savedAnswer = sessionStorage.getItem(`cw-answer-${code}`);
      if (savedAlias && savedToken) { setAlias(savedAlias); setAccessToken(savedToken); setJoining(false); setAnswer(savedAnswer ?? ""); setSubmitted(Boolean(savedAnswer)); }
      else api<{ alias: string; accessToken: string }>("/api/classroom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "join", code }) }).then((result) => { setAlias(result.alias); setAccessToken(result.accessToken); sessionStorage.setItem(`cw-alias-${code}`, result.alias); sessionStorage.setItem(`cw-student-token-${code}`, result.accessToken); setJoining(false); }).catch((cause) => { setError(cause instanceof Error ? cause.message : "Could not join"); setJoining(false); });
      refresh();
    }, 0);
    const id = window.setInterval(refresh, 1800); return () => { clearTimeout(start); clearInterval(id); };
  }, [code, refresh]);

  async function submitBelief() {
    try { await api("/api/classroom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "respond", code, accessToken, answer }) }); sessionStorage.setItem(`cw-answer-${code}`, answer); setSubmitted(true); refresh(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not submit belief"); }
  }
  async function submitPrediction(world: "A" | "B", evidence: string) {
    await api("/api/classroom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "predict", code, accessToken, selectedWorld: world, evidence }) }); setPredicted(world); refresh();
  }
  async function submitRevision() {
    await api("/api/classroom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revise", code, accessToken, beforeBelief: answer, afterBelief: revision }) }); refresh();
  }
  const alreadyRevised = state?.revisions.some((item) => item.alias === alias);
  if (joining || !state) return <Shell minimal><AppHeader code={code} role="Student" alias={alias || undefined} />{error ? <div className="error-state"><Orbit /><h1>Portal not found</h1><p>{error}</p><Link href="/">Try another code</Link></div> : <LoadingState label="Joining anonymously…" />}</Shell>;
  const status = state.session.status;

  return <Shell minimal><AppHeader code={code} role="Student" alias={alias} /><div className="student-shell">
    <div className="student-progress"><span className={submitted ? "done" : "active"}><i>{submitted ? <Check /> : "1"}</i>Explain</span><b /><span className={status === "launched" || status === "revealed" ? "active" : ""}><i>2</i>Experiment</span><b /><span className={status === "revealed" ? "active" : ""}><i>3</i>Revise</span></div>
    {error && <div className="inline-error">{error}</div>}
    {!submitted && status === "collecting" ? <section className="belief-entry"><span className="eyebrow"><BrainCircuit size={13} /> FIRST, MAKE YOUR MODEL VISIBLE</span><span className="question-number">QUESTION 01</span><h1>{state.session.question}</h1><p>There is no grade here. Explain the law you think the universe follows.</p><textarea autoFocus rows={6} value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="I think… because…" maxLength={1200} /><div className="entry-footer"><span>{answer.length} / 1200</span><button className="primary-button" onClick={submitBelief} disabled={answer.trim().length < 8}>Commit my belief <Send size={16} /></button></div><small><LockKeyhole /> Your classmates cannot see this answer until everyone has committed.</small></section> : null}
    {submitted && (status === "collecting" || status === "generating" || status === "world-ready") ? <section className="student-wait"><span className="waiting-orbit"><Orbit /></span><span className="eyebrow"><Radio size={13} /> BELIEF COMMITTED</span><h1>Your model is now part<br />of the class constellation.</h1><p>{status === "generating" ? "GPT-5.6 is compiling a world from your class's competing laws." : status === "world-ready" ? "The CounterWorld is ready. Your teacher will open the portal." : "Waiting for the rest of the class to make their reasoning visible."}</p><div className="your-belief"><span>YOUR BELIEF</span><blockquote>“{answer}”</blockquote></div><div className="waiting-dots"><i /><i /><i /></div></section> : null}
    {(status === "launched" || status === "revealed") && !alreadyRevised ? <section className="student-lab"><div className="student-lab-intro"><span className="eyebrow"><FlaskConical size={13} /> STEP 2 · TEST THE UNIVERSES</span><h1>Both worlds are internally consistent.<br /><em>Only one matches our universe.</em></h1><p>Change one variable at a time. Predict before the reveal.</p></div><WorldLab slug={state.session.worldSlug ?? "physics"} revealed={status === "revealed"} submittedPrediction={predicted} onPrediction={status === "launched" && !predicted ? submitPrediction : undefined} />{status === "launched" && predicted && <div className="prediction-locked"><Check /> Prediction locked. Keep experimenting while the class gathers evidence.</div>}{status === "revealed" && <div className="revision-entry"><span className="eyebrow"><Sparkles size={13} /> FINAL STEP · REBUILD THE MODEL</span><h2>{REFERENCE_WORLDS[state.session.worldSlug ?? "physics"]?.reflectionPrompt ?? "Rewrite your original law using the evidence you observed."}</h2><div className="belief-before"><span>BEFORE</span><p>{answer}</p></div><textarea rows={4} value={revision} onChange={(event) => setRevision(event.target.value)} placeholder="Now I think… because the experiment showed…" /><button className="primary-button" disabled={revision.trim().length < 10} onClick={submitRevision}>Submit my revised law <ArrowRight size={16} /></button></div>}</section> : null}
    {alreadyRevised && <section className="student-complete"><span className="completion-orb"><Check /></span><span className="eyebrow"><Sparkles size={13} /> MODEL REVISION COMPLETE</span><h1>You didn&apos;t memorize an answer.<br /><em>You changed a law.</em></h1><p>Your teacher can now see the class&apos;s conceptual shift—without attaching it to a grade.</p><div className="model-shift"><div><span>BEFORE</span><p>{answer}</p></div><ArrowRight /><div><span>AFTER</span><p>{state.revisions.find((item) => item.alias === alias)?.afterBelief}</p></div></div><Link href="/" className="secondary-button">Explore another CounterWorld</Link></section>}
  </div></Shell>;
}

function Showcase({ slug }: { slug: string }) {
  const world = REFERENCE_WORLDS[slug] ?? REFERENCE_WORLDS.physics;
  const related = Object.values(REFERENCE_WORLDS).filter((item) => item.slug !== world.slug);
  return <Shell minimal><AppHeader role="Explorer" /><div className="showcase-shell"><Link href="/" className="back-link"><ArrowLeft /> Back to world library</Link><div className="showcase-heading"><div><span className="eyebrow"><BookOpen size={13} /> VERIFIED REFERENCE WORLD</span><h1>{world.title}</h1><p>{world.domain}</p></div><div className="showcase-laws"><span><b>COUNTERFACTUAL LAW</b>{world.misconceptionLaw}</span><ArrowRight /><span><b>CANONICAL LAW</b>{world.canonicalLaw}</span></div></div><WorldLab slug={world.slug} revealed /><div className="related-worlds"><span>CONTINUE EXPLORING</span>{related.map((item) => <Link href={`/showcase/${item.slug}`} key={item.slug}>{item.domain}<b>{item.title}</b><ArrowRight /></Link>)}</div></div></Shell>;
}

export function CounterWorldsApp({ mode, initialCode = "ORBIT7", showcaseSlug = "physics" }: Props) {
  if (mode === "teacher") return <TeacherConsole code={initialCode} />;
  if (mode === "student") return <StudentExperience code={initialCode} />;
  if (mode === "showcase") return <Showcase slug={showcaseSlug} />;
  return <Landing />;
}
