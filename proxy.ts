import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  // Keep this aligned with `advanced.cookiePrefix` in lib/auth.ts. Without
  // the explicit prefix, the optimistic route guard only checks the default
  // `better-auth` cookie and immediately bounces authenticated teachers back
  // to sign-in after the Google callback.
  const cookie = getSessionCookie(request, { cookiePrefix: "counterworlds" });
  if (!cookie) {
    const url = new URL("/sign-in", request.url);
    url.searchParams.set("returnTo", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*", "/onboarding/:path*", "/settings/:path*", "/teacher/:path*", "/admin/:path*", "/two-factor/:path*", "/accept-invitation/:path*"] };
