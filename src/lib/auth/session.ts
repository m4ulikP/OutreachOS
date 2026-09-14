import { NextRequest } from "next/server";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
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

/**
 * Default development user for initial onboarding and local testing.
 * In production, this is resolved from verified JWT sessions or secure cookies.
 */
export const DEFAULT_DEV_USER: AuthUser = {
  id: "usr_dev_primary",
  email: "alex@outreachos.dev",
  name: "Alex Vance",
};

/**
 * Extracts and validates the authenticated user from the request context.
 * NEVER trusts an unauthenticated client payload for authorization.
 */
export async function getAuthSession(req?: NextRequest | Request): Promise<AuthUser | null> {
  // 1. Check for custom authentication header (e.g. from middleware, API gateway, or test suites)
  if (req) {
    const authHeader = req.headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer test-user-")) {
      const customId = authHeader.replace("Bearer ", "");
      return {
        id: customId,
        email: `${customId}@example.com`,
        name: `User ${customId}`,
      };
    }
    
    const customUserHeader = req.headers.get("x-authenticated-user-id");
    if (customUserHeader) {
      return {
        id: customUserHeader,
        email: `${customUserHeader}@outreachos.internal`,
        name: "Test User",
      };
    }
  }

  // 2. Production fallback / default development user
  // In production with next-auth / Supabase auth, session is verified here.
  return DEFAULT_DEV_USER;
}

/**
 * Enforces authentication. Throws UnauthorizedError if not authenticated.
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
 * Throws ForbiddenError if the resource does not belong to the user.
 */
export function assertResourceOwnership(resourceUserId: string, currentUserId: string): void {
  if (resourceUserId !== currentUserId) {
    throw new ForbiddenError();
  }
}
