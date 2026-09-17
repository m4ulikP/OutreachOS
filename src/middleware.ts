import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { extractRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Establish and propagate canonical request ID
  const requestId = extractRequestId(req);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);

  // Allow public assets and public endpoints unconditionally
  if (
    pathname.startsWith("/api/auth") ||
    pathname === "/api/health" ||
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    const res = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  }

  // Verify session token
  let token = null;
  try {
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (secret) {
      token = await getToken({ req, secret });
    }
  } catch {
    token = null;
  }

  // API routes return 401 JSON on missing/invalid authentication
  if (pathname.startsWith("/api/")) {
    if (!token) {
      const res = NextResponse.json(
        { error: "Authentication required to access this resource" },
        { status: 401 }
      );
      res.headers.set(REQUEST_ID_HEADER, requestId);
      return res;
    }
    const res = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  }

  // Application pages redirect unauthenticated users to /login
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const res = NextResponse.redirect(loginUrl);
    res.headers.set(REQUEST_ID_HEADER, requestId);
    return res;
  }

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  res.headers.set(REQUEST_ID_HEADER, requestId);
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
