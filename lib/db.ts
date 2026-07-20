import { Pool } from "pg";

const globalForDb = globalThis as unknown as { counterworldsPool?: Pool };
const connectionString = process.env.DATABASE_URL ?? "postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured";

function usesSupabasePooler(value: string) {
  try {
    return new URL(value).hostname.endsWith(".pooler.supabase.com");
  } catch {
    return false;
  }
}

export const db = globalForDb.counterworldsPool ?? new Pool({
  // Keep static builds possible before deployment secrets are attached. The
  // pool does not connect until a request uses authentication.
  connectionString,
  // Supabase's transaction pooler presents a managed TLS certificate chain
  // that Node's default verifier rejects in some serverless runtimes. Scope
  // this compatibility setting to Supabase pooler hosts only.
  ssl: usesSupabasePooler(connectionString) ? { rejectUnauthorized: false } : undefined,
  max: process.env.NODE_ENV === "production" ? 5 : 2,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
  options: "-c search_path=better_auth,public",
});

if (process.env.NODE_ENV !== "production") globalForDb.counterworldsPool = db;

export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: unknown[] = []) {
  return db.query<T>(text, values);
}
