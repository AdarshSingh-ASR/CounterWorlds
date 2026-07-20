import { Pool } from "pg";

const globalForDb = globalThis as unknown as { counterworldsPool?: Pool };

function configureConnectionString(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith(".pooler.supabase.com")) {
      // `pg` lets sslmode from the connection string override its `ssl`
      // option. Supabase pooler connections need TLS, but Vercel's runtime
      // cannot validate the pooler's certificate chain.
      url.searchParams.set("sslmode", "no-verify");
    }
    return url.toString();
  } catch {
    return value;
  }
}

const connectionString = configureConnectionString(
  process.env.DATABASE_URL ?? "postgresql://unconfigured:unconfigured@127.0.0.1:1/unconfigured",
);

export const db = globalForDb.counterworldsPool ?? new Pool({
  // Keep static builds possible before deployment secrets are attached. The
  // pool does not connect until a request uses authentication.
  connectionString,
  max: process.env.NODE_ENV === "production" ? 5 : 2,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 10_000,
  options: "-c search_path=better_auth,public",
});

if (process.env.NODE_ENV !== "production") globalForDb.counterworldsPool = db;

export async function sql<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values: unknown[] = []) {
  return db.query<T>(text, values);
}
