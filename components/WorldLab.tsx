"use client";

import { useState } from "react";
import { ArrowRight, Check, FlaskConical, Sparkles } from "lucide-react";
import type { ClassroomState } from "../lib/counterworlds";

type World = NonNullable<ClassroomState["world"]>;

type Props = {
  world: World;
  revealed?: boolean;
  compact?: boolean;
  onPrediction?: (world: "A" | "B", evidence: string) => Promise<void> | void;
  submittedPrediction?: "A" | "B" | null;
};

export function WorldLab({ world, revealed = false, compact = false, onPrediction, submittedPrediction = null }: Props) {
  const [selection, setSelection] = useState<"A" | "B" | null>(submittedPrediction);
  const [evidence, setEvidence] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!selection || !onPrediction) return;
    setSending(true);
    try {
      await onPrediction(selection, evidence);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className={`world-lab generated-world-lab ${compact ? "world-lab-compact" : ""}`}>
      <div className="lab-heading">
        <div><span className="eyebrow"><FlaskConical size={13} /> LIVE GENERATED EXPERIMENT</span><h2>{world.title}</h2></div>
        <span className="model-chip"><Sparkles size={13} /> {world.sourceModel} · sandbox verified</span>
      </div>
      <p className="lab-prompt">{world.predictionPrompt}</p>
      <iframe
        className="generated-world-frame"
        src={`/api/worlds/${encodeURIComponent(world.slug)}`}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        title={`${world.title} generated CounterWorld experiment`}
      />
      {!revealed && onPrediction ? (
        <div className="prediction-box generated-prediction-box">
          <div><b>Which world matches real evidence?</b><span>Experiment first, then lock your prediction.</span></div>
          <div className="prediction-world-buttons" role="group" aria-label="Select the world that matches evidence">
            {(["A", "B"] as const).map((letter) => <button key={letter} type="button" aria-pressed={selection === letter} className={selection === letter ? "selected" : ""} onClick={() => setSelection(letter)}>World {letter}</button>)}
          </div>
          <textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="The evidence I observed was…" rows={2} maxLength={800} />
          <button type="button" className="primary-button compact-button" disabled={!selection || evidence.trim().length < 5 || sending} onClick={submit}>{sending ? "Recording…" : "Lock prediction"}<ArrowRight size={16} /></button>
        </div>
      ) : null}
      {revealed && world.reveal ? (
        <div className="reveal-card"><span><Check size={17} /></span><div><b>World {world.reveal.correctWorld} matches the accepted model. {world.reveal.explanation}</b><p>{world.evidenceExplanation}</p></div></div>
      ) : null}
    </section>
  );
}
