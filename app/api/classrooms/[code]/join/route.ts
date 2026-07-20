import { NextResponse } from "next/server";
import { consumeRateLimit } from "../../../../../lib/access";
import { joinSession } from "../../../../../lib/classroom-store";
import { apiError } from "../../../../../lib/http";
import { requestNetworkKey } from "../../../../../lib/security";

export async function POST(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const code = (await params).code.toUpperCase();
    const network = requestNetworkKey(request.headers);
    await consumeRateLimit(`join:ip:${network}`, 120, 600);
    await consumeRateLimit(`join:code:${code}`, 300, 600);
    const body = await request.json() as { nickname?: string; noticeAccepted?: boolean };
    return NextResponse.json(await joinSession(code, String(body.nickname ?? ""), body.noticeAccepted === true), { status: 201 });
  } catch (error) { return apiError(error); }
}
