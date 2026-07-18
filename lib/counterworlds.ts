import { z } from "zod";

export const generationStatuses = [
  "queued",
  "analyzing",
  "generating",
  "validating",
  "ready",
  "failed",
  "fallback",
] as const;

export const GenerationStatusSchema = z.enum(generationStatuses);
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

export const GenerationRequestSchema = z.object({
  sessionId: z.string().min(1),
  prompt: z.string().min(10).max(800),
  learningObjective: z.string().min(10).max(800),
  canonicalModel: z.string().min(10).max(1600),
  responses: z.array(
    z.object({ alias: z.string().min(1).max(40), answer: z.string().min(1).max(1200) }),
  ),
});
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;

export const WorldManifestSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  domain: z.string(),
  misconceptionLaw: z.string(),
  canonicalLaw: z.string(),
  controls: z.array(z.object({ id: z.string(), label: z.string(), min: z.number(), max: z.number(), step: z.number(), unit: z.string().optional() })),
  predictionPrompt: z.string(),
  evidenceExplanation: z.string(),
  reveal: z.object({ correctWorld: z.enum(["A", "B"]), explanation: z.string() }),
  reflectionPrompt: z.string(),
  sourceModel: z.string(),
  fallback: z.boolean().default(false),
});
export type WorldManifest = z.infer<typeof WorldManifestSchema>;

export type Cluster = {
  key: string;
  label: string;
  count: number;
  color: "violet" | "cyan" | "amber";
  description: string;
};

export type ClassroomState = {
  session: {
    id: string;
    code: string;
    question: string;
    learningObjective: string;
    canonicalModel: string;
    domain: string;
    status: "collecting" | "generating" | "world-ready" | "launched" | "revealed";
    worldSlug: string | null;
  };
  responses: Array<{ id: string; alias: string; answer: string; clusterKey: string }>;
  predictions: Array<{ alias: string; selectedWorld: "A" | "B"; evidence: string }>;
  revisions: Array<{ alias: string; beforeBelief: string; afterBelief: string; changed: boolean }>;
  job: { id: string; status: GenerationStatus; stage: string; progress: number; worldSlug: string | null; error: string | null } | null;
  clusters: Cluster[];
};

export const REFERENCE_WORLDS: Record<string, WorldManifest> = {
  physics: {
    id: "world-physics-force",
    slug: "physics",
    title: "The Cart Paradox",
    domain: "Physics · Dynamics",
    misconceptionLaw: "Under the same force, more mass creates more acceleration.",
    canonicalLaw: "Under the same force, acceleration decreases as mass increases: a = F/m.",
    controls: [
      { id: "force", label: "Applied force", min: 2, max: 12, step: 1, unit: "N" },
      { id: "time", label: "Elapsed time", min: 0, max: 4, step: 0.1, unit: "s" },
    ],
    predictionPrompt: "Which universe matches what two real carts would do under the same force?",
    evidenceExplanation: "With equal force, the 1 kg cart accelerates four times as much as the 4 kg cart. Mass resists acceleration; it does not amplify it.",
    reveal: { correctWorld: "B", explanation: "World B obeys Newton's second law: a = F/m." },
    reflectionPrompt: "Rewrite your law for how force, mass, and acceleration relate.",
    sourceModel: "gpt-5.6-sol",
    fallback: true,
  },
  mathematics: {
    id: "world-math-transform",
    slug: "mathematics",
    title: "The Sideways Function",
    domain: "Mathematics · Functions",
    misconceptionLaw: "Adding h inside f(x + h) shifts a graph h units to the right.",
    canonicalLaw: "Adding h inside f(x + h) shifts a graph h units to the left.",
    controls: [{ id: "shift", label: "Value of h", min: -4, max: 4, step: 1, unit: "" }],
    predictionPrompt: "Which universe keeps the output unchanged by moving each input in the correct direction?",
    evidenceExplanation: "To recover the old input x, the new graph must use x = -h. The inside operation is compensated in the opposite direction.",
    reveal: { correctWorld: "B", explanation: "World B places the vertex at x = -h." },
    reflectionPrompt: "Explain why horizontal transformations feel reversed.",
    sourceModel: "gpt-5.6-sol",
    fallback: true,
  },
  chemistry: {
    id: "world-chem-catalyst",
    slug: "chemistry",
    title: "The Catalyst Mirage",
    domain: "Chemistry · Equilibrium",
    misconceptionLaw: "More catalyst increases the final amount of product at equilibrium.",
    canonicalLaw: "A catalyst speeds both directions equally, reaching the same equilibrium sooner.",
    controls: [
      { id: "catalyst", label: "Catalyst level", min: 0, max: 100, step: 5, unit: "%" },
      { id: "time", label: "Reaction time", min: 0, max: 100, step: 1, unit: "s" },
    ],
    predictionPrompt: "Which universe changes the journey to equilibrium without changing the destination?",
    evidenceExplanation: "Catalysts lower activation energy for forward and reverse reactions. They change rate, not the equilibrium constant.",
    reveal: { correctWorld: "B", explanation: "World B reaches the same final mixture faster." },
    reflectionPrompt: "Distinguish what a catalyst changes from what it leaves unchanged.",
    sourceModel: "gpt-5.6-sol",
    fallback: true,
  },
};

export function classifyResponse(answer: string): string {
  const lower = answer.toLowerCase();
  if (/heav|mass|weight|bigger/.test(lower) && /fast|acceler|far|more/.test(lower)) return "mass-amplifies";
  if (/same|equal|together/.test(lower)) return "same-acceleration";
  if (/light|less mass|f\s*\/\s*m|newton/.test(lower)) return "canonical";
  return "uncertain";
}

export function buildClusters(responses: Array<{ clusterKey: string }>): Cluster[] {
  const counts = new Map<string, number>();
  for (const response of responses) counts.set(response.clusterKey, (counts.get(response.clusterKey) ?? 0) + 1);
  const definitions: Record<string, Omit<Cluster, "count">> = {
    "mass-amplifies": { key: "mass-amplifies", label: "Mass amplifies force", color: "violet", description: "Heavier objects should accelerate faster." },
    "same-acceleration": { key: "same-acceleration", label: "Same force, same motion", color: "amber", description: "Equal force should produce equal acceleration." },
    canonical: { key: "canonical", label: "Inertia model", color: "cyan", description: "More mass means less acceleration." },
    uncertain: { key: "uncertain", label: "Unresolved model", color: "amber", description: "The relationship is not yet explicit." },
  };
  return [...counts.entries()]
    .map(([key, count]) => ({ ...(definitions[key] ?? definitions.uncertain), count }))
    .sort((a, b) => b.count - a.count);
}

export function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function randomAlias(index = 0) {
  const adjectives = ["Quiet", "Curious", "Luminous", "Brave", "Keen", "Orbiting", "Patient", "Bold"];
  const nouns = ["Quasar", "Pulsar", "Comet", "Nova", "Photon", "Nebula", "Meteor", "Orbit"];
  return `${adjectives[index % adjectives.length]} ${nouns[(index * 3 + 1) % nouns.length]}`;
}
