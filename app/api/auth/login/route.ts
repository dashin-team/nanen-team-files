import { NextResponse, type NextRequest } from "next/server";
import { clientIp, jsonError, sessionCookie } from "@/lib/http";
import {
  clearLoginFailures,
  getSessionSecret,
  getTeamPassword,
  loginBlocked,
  passwordsMatch,
  recordLoginFailure,
  signSession,
} from "@/lib/session";

export const maxDuration = 15;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request);
    if (loginBlocked(ip)) {
      return NextResponse.json({ error: "嘗試太多次，請 15 分鐘後再試。" }, { status: 429 });
    }
    const expected = getTeamPassword();
    if (!expected) {
      return NextResponse.json(
        { error: "系統還沒設定團隊密碼。請管理員設定 TEAM_PASSWORD。" },
        { status: 503 },
      );
    }
    const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json({ error: "請輸入團隊密碼。" }, { status: 400 });
    }
    if (!passwordsMatch(password, expected)) {
      recordLoginFailure(ip);
      await delay(600);
      return NextResponse.json({ error: "密碼不正確，請再試一次。" }, { status: 401 });
    }
    clearLoginFailures(ip);
    const token = await signSession(getSessionSecret());
    const cookie = sessionCookie(token);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookie.name, cookie.value, cookie.options);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
