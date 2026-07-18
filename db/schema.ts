import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  teacherToken: text("teacher_token").notNull(),
  question: text("question").notNull(),
  learningObjective: text("learning_objective").notNull(),
  canonicalModel: text("canonical_model").notNull(),
  domain: text("domain").notNull().default("Physics"),
  status: text("status").notNull().default("collecting"),
  worldSlug: text("world_slug"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  alias: text("alias").notNull(),
  accessToken: text("access_token").notNull().unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  alias: text("alias").notNull(),
  answer: text("answer").notNull(),
  clusterKey: text("cluster_key").notNull().default("unclassified"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const predictions = sqliteTable("predictions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  alias: text("alias").notNull(),
  selectedWorld: text("selected_world").notNull(),
  evidence: text("evidence").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const revisions = sqliteTable("revisions", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  alias: text("alias").notNull(),
  beforeBelief: text("before_belief").notNull(),
  afterBelief: text("after_belief").notNull(),
  changed: integer("changed", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const generationJobs = sqliteTable("generation_jobs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  status: text("status").notNull().default("queued"),
  stage: text("stage").notNull().default("queued"),
  progress: integer("progress").notNull().default(0),
  worldSlug: text("world_slug"),
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const worlds = sqliteTable("worlds", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  sessionId: text("session_id"),
  manifest: text("manifest", { mode: "json" }).notNull(),
  artifactKey: text("artifact_key"),
  sourceModel: text("source_model").notNull(),
  validationStatus: text("validation_status").notNull().default("verified"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
