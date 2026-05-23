import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("bt_token")?.value;
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return token
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
