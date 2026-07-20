import "server-only";
import { headers } from "next/headers";
import { auth } from "./auth";

export async function getAuthSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireAuthSession() {
  const session = await getAuthSession();
  if (!session) throw new Error("Sign in to continue");
  if (session.user.banned) throw new Error("This account is suspended");
  return session;
}

export function isPlatformAdmin(user: { role?: string | null }) {
  return user.role === "admin";
}
