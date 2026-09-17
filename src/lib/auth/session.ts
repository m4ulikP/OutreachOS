import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { decode } from "next-auth/jwt";
import { authOptions, getAuthSecret } from "./auth-options";

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required to access this resource") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to access this resource") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "Resource not found") {
    super(message);
    this.name = "NotFoundError";
  }
}

/**
 * Extracts a signed JWT session token from request headers or cookies.
 * Does NOT accept or trust raw unauthenticated user IDs.
 */
function extractRawToken(req: NextRequest | Request): string | null {
  // 1. Check for Authorization: Bearer <signed_jwt>
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const candidate = authHeader.slice(7).trim();
    if (candidate) return candidate;
  }

  // 2. Check for NextRequest.cookies (Next.js server context)
  if ("cookies" in req && typeof (req as NextRequest).cookies?.get === "function") {
    const nextReq = req as NextRequest;
    const cookieVal =
      nextReq.cookies.get("__Secure-next-auth.session-token")?.value ||
      nextReq.cookies.get("next-auth.session-token")?.value;
    if (cookieVal) return cookieVal;
  }

  // 3. Check for standard Cookie header (Web API Request context / test runner)
  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, decodeURIComponent((v || []).join("="))];
      })
    );
    return (
      cookies["__Secure-next-auth.session-token"] ||
      cookies["next-auth.session-token"] ||
      null
    );
  }

  return null;
}

/**
 * Extracts and cryptographically verifies the authenticated user from:
 * 1. An incoming NextRequest or Web Request (via verified signed session cookie or Bearer JWT)
 * 2. Or the active Server Component context (via getServerSession)
 *
 * NEVER trusts unauthenticated client-supplied IDs (e.g. x-authenticated-user-id).
 * NEVER silently falls back to a shared or dev user.
 */
export async function getAuthSession(req?: NextRequest | Request): Promise<AuthUser | null> {
  // If an explicit request was provided, inspect headers/cookies
  if (req) {
    const rawToken = extractRawToken(req);
    if (!rawToken) {
      return null;
    }

    try {
      const secret = getAuthSecret();
      const decoded = await decode({ token: rawToken, secret });
      if (decoded && (decoded.id || decoded.sub)) {
        return {
          id: (decoded.id || decoded.sub) as string,
          email: (decoded.email as string) || "",
          name: (decoded.name as string) || null,
        };
      }
      return null;
    } catch {
      // Signature verification failed, token expired, or malformed JWE
      return null;
    }
  }

  // If called without req, resolve from Next.js Server Component cookies context
  try {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as { id?: string }).id) {
      return {
        id: (session.user as { id?: string }).id as string,
        email: session.user.email || "",
        name: session.user.name || null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Enforces authentication. Throws UnauthorizedError (401) if not authenticated.
 */
export async function requireAuthUser(req?: NextRequest | Request): Promise<AuthUser> {
  const user = await getAuthSession(req);
  if (!user || !user.id) {
    throw new UnauthorizedError();
  }
  return user;
}

/**
 * Enforces ownership of a resource.
 * Throws ForbiddenError (403) if the resource does not belong to the user.
 */
export function assertResourceOwnership(resourceUserId: string, currentUserId: string): void {
  if (resourceUserId !== currentUserId) {
    throw new ForbiddenError();
  }
}
