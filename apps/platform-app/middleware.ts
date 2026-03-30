import { NextResponse, type NextRequest } from "next/server";

const SESSION = "anang_demo_session";

function readSession(request: NextRequest): { appRole?: string } | null {
  const raw = request.cookies.get(SESSION)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as { appRole?: string };
  } catch {
    return null;
  }
}

/**
 * Edge-friendly gate: ensures a session cookie exists on protected routes.
 * Fine-grained tenant membership checks run in Server Components (Prisma).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = readSession(request);

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (session.appRole !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/login?error=forbidden", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/o/")) {
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/o/:path*"],
};
