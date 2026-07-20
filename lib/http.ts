import { NextResponse } from "next/server";

export function apiError(error: unknown, fallbackStatus = 400) {
  const typed = error as Error & { retryAfter?: number };
  const message = typed instanceof Error ? typed.message : "Something went wrong";
  const status = typed.retryAfter ? 429 : /sign in/i.test(message) ? 401 : /access|verified|owner|admin/i.test(message) ? 403 : fallbackStatus;
  return NextResponse.json({ error: message }, {
    status,
    headers: typed.retryAfter ? { "Retry-After": String(typed.retryAfter) } : undefined,
  });
}
