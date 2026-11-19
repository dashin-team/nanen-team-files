import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { HttpError } from "@/lib/errors";
import {
  COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  getSessionSecret,
  verifySession,
} from "@/lib/session";

export async function isAuthenticated(request: NextRequest): Promise<boolean> {
  try {
    return await verifySession(request.cookies.get(COOKIE_NAME)?.value, getSessionSecret());
  } catch {
    return false;
  }
}

export async function requireSession(request: NextRequest): Promise<void> {
  if (!(await isAuthenticated(request))) {
    throw new HttpError(401, "請先登入");
  }
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim().slice(0, 64) || "unknown";
  return request.headers.get("x-real-ip")?.slice(0, 64) || "local";
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    },
  };
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(error);
  return NextResponse.json({ error: "系統忙碌，請稍後再試。" }, { status: 500 });
}
