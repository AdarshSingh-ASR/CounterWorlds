"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, FlaskConical, Gauge, RotateCcw, Sparkles } from "lucide-react";
import { REFERENCE_WORLDS } from "../lib/counterworlds";

type Props = {
  slug: string;
  revealed?: boolean;
  compact?: boolean;
  onPrediction?: (world: "A" | "B", evidence: string) => Promise<void> | void;
  submittedPrediction?: "A" | "B" | null;
};

function PhysicsScene({ force, time, mistaken }: { force: number; time: number; mistaken: boolean }) {
  const position = (mass: number) => {
    const acceleration = mistaken ? force * Math.sqrt(mass) : force / mass;
    return Math.min(82, 4 + acceleration * time * time * 0.72);
  };
  const light = position(1);
  const heavy = position(4);
  return (
    <div className="track-scene" aria-label="Cart motion experiment">
      <div className="track-row"><span className="mass-label">1 kg</span><div className="track-line"><span className="cart cart-light" style={{ left: `${light}%` }}><span /></span></div></div>
      <div className="track-row"><span className="mass-label">4 kg</span><div className="track-line"><span className="cart cart-heavy" style={{ left: `${heavy}%` }}><span /><span /></span></div></div>
      <div className="scene-readout"><span>Δx light <b>{light.toFixed(0)}m</b></span><span>Δx heavy <b>{heavy.toFixed(0)}m</b></span></div>
    </div>
  );
}

function MathScene({ shift, mistaken }: { shift: number; mistaken: boolean }) {
  const vertex = mistaken ? shift : -shift;
  const left = 50 + vertex * 8;
  const points = Array.from({ length: 9 }, (_, index) => {
    const x = index - 4;
    const y = Math.min(85, (x - vertex) ** 2 * 4);
    return { left: 50 + x * 10, bottom: 12 + y * 0.72 };
  });
  return (
    <div className="graph-scene">
      <div className="graph-axis graph-axis-x" /><div className="graph-axis graph-axis-y" />
      {points.map((point, index) => <span key={index} className="graph-point" style={{ left: `${point.left}%`, bottom: `${point.bottom}%` }} />)}
      <span className="vertex-marker" style={{ left: `${left}%` }}><b>x = {vertex}</b></span>
      <div className="graph-equation">f(x + {shift})</div>
    </div>
  );
}

function ChemistryScene({ catalyst, time, mistaken }: { catalyst: number; time: number; mistaken: boolean }) {
  const speed = 0.018 + catalyst * 0.0008;
  const finalProduct = mistaken ? 54 + catalyst * 0.32 : 68;
  const product = Math.min(finalProduct, finalProduct * (1 - Math.exp(-time * speed)));
  return (
    <div className="chem-scene">
      <div className="molecule-field" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => {
          const converted = index < Math.round(product / 100 * 18);
          return <span key={index} className={converted ? "molecule product" : "molecule reactant"} style={{ left: `${9 + (index % 6) * 15}%`, top: `${18 + Math.floor(index / 6) * 25}%` }} />;
        })}
      </div>
      <div className="equilibrium-meter"><span style={{ width: `${product}%` }} /><b>{product.toFixed(0)}% product</b></div>
      <div className="scene-readout"><span>Rate <b>{(speed * 100).toFixed(1)}×</b></span><span>Final yield <b>{finalProduct.toFixed(0)}%</b></span></div>
    </div>
  );
}

export function WorldLab({ slug, revealed = false, compact = false, onPrediction, submittedPrediction = null }: Props) {
  const isGeneratedWorld = !REFERENCE_WORLDS[slug];
  const manifest = REFERENCE_WORLDS[slug] ?? REFERENCE_WORLDS.physics;
  const [force, setForce] = useState(7);
  const [time, setTime] = useState(slug === "chemistry" ? 42 : 2.6);
  const [shift, setShift] = useState(2);
  const [catalyst, setCatalyst] = useState(65);
  const [selection, setSelection] = useState<"A" | "B" | null>(submittedPrediction);
  const [evidence, setEvidence] = useState("");
  const [sending, setSending] = useState(false);
  const scenes = useMemo(() => {
    if (slug === "mathematics") return [<MathScene key="a" shift={shift} mistaken />, <MathScene key="b" shift={shift} mistaken={false} />];
    if (slug === "chemistry") return [<ChemistryScene key="a" catalyst={catalyst} time={time} mistaken />, <ChemistryScene key="b" catalyst={catalyst} time={time} mistaken={false} />];
    return [<PhysicsScene key="a" force={force} time={time} mistaken />, <PhysicsScene key="b" force={force} time={time} mistaken={false} />];
  }, [slug, force, time, shift, catalyst]);

  async function submit() {
    if (!selection || !onPrediction) return;
    setSending(true);
    await onPrediction(selection, evidence);
    setSending(false);
  }

  if (isGeneratedWorld) {
    return (
      <section className={`world-lab generated-world-lab ${compact ? "world-lab-compact" : ""}`}>
        <div className="lab-heading">
          <div><span className="eyebrow"><FlaskConical size={13} /> LIVE GENERATED EXPERIMENT</span><h2>Class-compiled CounterWorld</h2></div>
          <span className="model-chip"><Sparkles size={13} /> Sandboxed · verified</span>
        </div>
        <iframe
          className="generated-world-frame"
          src={`/api/worlds/${encodeURIComponent(slug)}`}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          title="Generated CounterWorld experiment"
        />
      </section>
    );
  }

  return (
    <section className={`world-lab ${compact ? "world-lab-compact" : ""}`}>
      <div className="lab-heading">
        <div><span className="eyebrow"><FlaskConical size={13} /> LIVE CONTRAST EXPERIMENT</span><h2>{manifest.title}</h2></div>
        <span className="model-chip"><Sparkles size={13} /> Compiled by {manifest.sourceModel}</span>
      </div>
      <p className="lab-prompt">{manifest.predictionPrompt}</p>
      <div className="world-grid">
        {(["A", "B"] as const).map((letter, index) => (
          <button key={letter} type="button" className={`world-panel world-${letter.toLowerCase()} ${selection === letter ? "selected" : ""} ${revealed && manifest.reveal.correctWorld === letter ? "correct" : ""}`} onClick={() => !revealed && setSelection(letter)} aria-pressed={selection === letter}>
            <span className="world-label"><span>WORLD {letter}</span>{revealed && manifest.reveal.correctWorld === letter && <b><Check size={12} /> MATCHES EVIDENCE</b>}</span>
            {scenes[index]}
          </button>
        ))}
      </div>
      <div className="lab-controls">
        <div className="control-title"><Gauge size={16} /><span>Shared controls</span><button type="button" onClick={() => { setForce(7); setTime(slug === "chemistry" ? 42 : 2.6); setShift(2); setCatalyst(65); }}><RotateCcw size={13} /> Reset</button></div>
        {slug === "physics" && <><label>Applied force <output>{force} N</output><input type="range" min="2" max="12" step="1" value={force} onChange={(event) => setForce(Number(event.target.value))} /></label><label>Elapsed time <output>{time.toFixed(1)} s</output><input type="range" min="0" max="4" step="0.1" value={time} onChange={(event) => setTime(Number(event.target.value))} /></label></>}
        {slug === "mathematics" && <label>Value of h <output>{shift}</output><input type="range" min="-4" max="4" step="1" value={shift} onChange={(event) => setShift(Number(event.target.value))} /></label>}
        {slug === "chemistry" && <><label>Catalyst level <output>{catalyst}%</output><input type="range" min="0" max="100" step="5" value={catalyst} onChange={(event) => setCatalyst(Number(event.target.value))} /></label><label>Reaction time <output>{time.toFixed(0)} s</output><input type="range" min="0" max="100" step="1" value={time} onChange={(event) => setTime(Number(event.target.value))} /></label></>}
      </div>
      {revealed ? (
        <div className="reveal-card"><span><Check size={17} /></span><div><b>{manifest.reveal.explanation}</b><p>{manifest.evidenceExplanation}</p></div></div>
      ) : onPrediction ? (
        <div className="prediction-box">
          <div><b>Your evidence note</b><span>Choose a world, then explain what convinced you.</span></div>
          <textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="I changed the force and noticed…" rows={2} />
          <button type="button" className="primary-button compact-button" disabled={!selection || sending} onClick={submit}>{sending ? "Recording…" : "Lock prediction"}<ArrowRight size={16} /></button>
        </div>
      ) : null}
    </section>
  );
}
