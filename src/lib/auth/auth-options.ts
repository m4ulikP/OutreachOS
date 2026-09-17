import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";

/**
 * Validates and retrieves the server-only authentication secret.
 * Enforces fail-fast behavior if AUTH_SECRET is not configured.
 */
export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "CRITICAL SECURITY CONFIGURATION ERROR: AUTH_SECRET is not configured in production."
      );
    }
    throw new Error(
      "AUTH_SECRET is required. Please set AUTH_SECRET in your environment or .env file."
    );
  }
  return secret;
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  providers: [
    CredentialsProvider({
      id: "credentials",
      name: "OutreachOS Studio Account",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "alex@outreachos.dev" },
        name: { label: "Name", type: "text", placeholder: "Alex Vance" },
      },
      async authorize(credentials) {
        if (!credentials?.email || typeof credentials.email !== "string") {
          return null;
        }

        const email = credentials.email.toLowerCase().trim();
        if (!email.includes("@") || email.length < 5) {
          return null;
        }

        try {
          // Look up user or auto-create during onboarding
          let user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: credentials.name?.trim() || email.split("@")[0],
              },
            });
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name ?? undefined,
          };
        } catch (dbError: unknown) {
          // If the database is unreachable, log warning and derive deterministic tenant ID
          // to allow the user to view the studio and inspect the DB offline status banner.
          const msg = dbError instanceof Error ? dbError.message : String(dbError);
          console.warn("[Auth] Database unavailable during sign-in, creating offline session:", msg);

          return {
            id: `usr_${Buffer.from(email).toString("hex").slice(0, 16)}`,
            email,
            name: credentials.name?.trim() || email.split("@")[0],
          };
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        (session.user as { id?: string }).id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
