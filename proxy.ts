import { NextResponse, type NextRequest } from "next/server";
import { isAuthenticated } from "@/lib/http";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/icon.svg"
  ) {
    return NextResponse.next();
  }

  let authed = false;
  try {
    authed = await isAuthenticated(request);
  } catch {
    authed = false;
  }

  if (pathname === "/login") {
    if (authed) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }

  if (pathname === "/api/auth/login") return NextResponse.next();

  if (!authed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "請先登入" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|_next/hmr|_next/webpack-hmr|brand/|favicon.ico|icon.svg).*)"],
};
