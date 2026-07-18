import Link from "next/link";
import { Atom, Sparkles } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="CounterWorlds home">
      <span className="brand-mark"><Atom size={compact ? 17 : 20} strokeWidth={1.8} /><Sparkles className="brand-spark" size={8} /></span>
      <span>COUNTER<span>WORLDS</span></span>
      {!compact && <span className="brand-beta">LAB</span>}
    </Link>
  );
}
