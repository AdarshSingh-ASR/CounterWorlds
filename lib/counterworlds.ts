import { z } from "zod";

export const generationStatuses = [
  "queued",
  "analyzing",
  "generating",
  "validating",
  "ready",
  "failed",
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
  ).min(1),
});
export type GenerationRequest = z.infer<typeof GenerationRequestSchema>;

export const WorldManifestSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  title: z.string().min(1),
  domain: z.string().min(1),
  misconceptionLaw: z.string().min(1),
  canonicalLaw: z.string().min(1),
  controls: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    min: z.number(),
    max: z.number(),
    step: z.number().positive(),
    unit: z.string().optional(),
  })).min(1),
  predictionPrompt: z.string().min(1),
  evidenceExplanation: z.string().min(1),
  reveal: z.object({ correctWorld: z.enum(["A", "B"]), explanation: z.string().min(1) }),
  reflectionPrompt: z.string().min(1),
  sourceModel: z.literal("gpt-5.6-sol"),
  misconceptionClusters: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1),
    color: z.enum(["violet", "cyan", "amber"]),
    responseAliases: z.array(z.string().min(1).max(40)),
  })).min(1),
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
  world: {
    slug: string;
    title: string;
    predictionPrompt: string;
    reflectionPrompt: string;
    sourceModel: "gpt-5.6-sol";
    reveal: { correctWorld: "A" | "B"; explanation: string } | null;
    evidenceExplanation: string;
  } | null;
};

export function buildClusters(manifest: WorldManifest | null): Cluster[] {
  if (!manifest) return [];
  return manifest.misconceptionClusters
    .map((cluster) => ({
      key: cluster.id,
      label: cluster.label,
      description: cluster.description,
      color: cluster.color,
      count: new Set(cluster.responseAliases).size,
    }))
    .filter((cluster) => cluster.count > 0)
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
