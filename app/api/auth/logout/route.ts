import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/session";
import { requireSession, jsonError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    await requireSession(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
