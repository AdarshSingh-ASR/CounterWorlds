"use client";

import Link from "next/link";
import { ArrowRight, ChevronDown, LockKeyhole, Menu, Play } from "lucide-react";
import { useState } from "react";
import { ParticleField } from "./ParticleField";

function Mark() {
  return <span className="signal-mark" aria-hidden="true"><i /><i /><i /></span>;
}

export function LandingPage() {
  const [code, setCode] = useState("");
  const normalized = code.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, 6);
  return <main className="signal-site">
    <header className="signal-nav">
      <Link href="/" className="signal-logo" aria-label="CounterWorlds home"><Mark /><span>COUNTERWORLDS</span></Link>
      <nav aria-label="Main navigation">
        <a href="#product">Product</a><a href="#schools">Schools</a><a href="#safety">Safety</a><a href="#about">About</a>
      </nav>
      <div className="signal-nav-actions"><Link href="/sign-in" className="signal-login">Sign in</Link><Link href="/sign-in" className="signal-nav-cta">Start a pilot <ArrowRight /></Link><button className="signal-menu" aria-label="Open menu"><Menu /></button></div>
    </header>
    <section className="signal-hero" id="product">
      <div className="signal-pill">LIVE CLASSROOM INTELLIGENCE <span>•</span> BUILT FOR PRODUCTIVE STRUGGLE</div>
      <h1>Every Belief.<br /><em>A Testable World.</em></h1>
      <p>CounterWorlds turns the class&apos;s real misconceptions into interactive universes—so students can predict, experiment, and change their own minds.</p>
      <div className="signal-actions"><Link href="/sign-in" className="signal-primary">Start a school pilot <ArrowRight /></Link><a href="#schools" className="signal-secondary"><Play /> See how it works</a></div>
      <div className="signal-join"><label htmlFor="landing-code">Already in a classroom?</label><input id="landing-code" value={normalized} onChange={(event) => setCode(event.target.value)} placeholder="JOIN CODE" maxLength={6} /><Link href={normalized.length === 6 ? `/join/${normalized}` : "#"} aria-disabled={normalized.length !== 6}>Enter world <ArrowRight /></Link></div>
      <div className="signal-trust"><span><LockKeyhole /> Anonymous students</span><span>School-authorized 13+</span><span>No fabricated classroom data</span></div>
      <a href="#schools" className="scroll-cue" aria-label="Learn more"><span>Explore the system</span><ChevronDown /></a>
    </section>
    <ParticleField />
    <section className="signal-proof" id="schools">
      <div><span>01</span><h2>Collect the law<br />students actually believe.</h2><p>Short, private explanations become the raw material—not scores, profiles, or generic content.</p></div>
      <div><span>02</span><h2>Compile two<br />competing universes.</h2><p>Gemini or teacher-provided OpenAI access generates a safe, class-specific experiment from real responses.</p></div>
      <div><span>03</span><h2>Measure the<br />model shift.</h2><p>Teachers see whether evidence changed the learner&apos;s explanation, not just whether a button was correct.</p></div>
    </section>
    <section className="signal-safety" id="safety"><p>Designed for a real school pilot</p><h2>Identity for teachers.<br />Privacy for students.</h2><div><span>Google-secured teacher accounts</span><span>90-day archived-data retention</span><span>Sandboxed generated worlds</span><span>Encrypted teacher API keys</span></div></section>
    <footer className="signal-footer" id="about"><Link href="/" className="signal-logo"><Mark /><span>COUNTERWORLDS</span></Link><p>AI tutors give answers. CounterWorlds makes beliefs testable.</p><nav><Link href="/privacy">Privacy</Link><Link href="/student-privacy">Student privacy</Link><Link href="/terms">Terms</Link><Link href="/acceptable-use">Acceptable use</Link></nav></footer>
  </main>;
}
