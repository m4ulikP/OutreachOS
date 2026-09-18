import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/db";
import { verifyPassword } from "./password";
import { logger } from "@/lib/logger";

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

const providers: NextAuthOptions["providers"] = [
  CredentialsProvider({
    id: "credentials",
    name: "OutreachOS Studio Account",
    credentials: {
      email: { label: "Email", type: "email", placeholder: "you@example.com" },
      password: { label: "Password", type: "password" },
      name: { label: "Name", type: "text" },
    },
    async authorize(credentials) {
      if (!credentials?.email || typeof credentials.email !== "string") {
        return null;
      }

      const email = credentials.email.toLowerCase().trim();
      const password = credentials.password;

      if (!email.includes("@") || email.length < 5) {
        return null;
      }

      // Non-production convenience: Allow dev quick-access login for Maulik Pandey
      if (
        process.env.NODE_ENV !== "production" &&
        email === "maulik@outreachos.dev" &&
        (!password || password === "dev-quick-access")
      ) {
        let devUser = await prisma.user.findUnique({
          where: { email },
        });
        if (!devUser) {
          devUser = await prisma.user.create({
            data: {
              email,
              name: "Maulik Pandey",
              emailVerified: new Date(),
              sessionVersion: 1,
            },
          });
        }
        return {
          id: devUser.id,
          email: devUser.email,
          name: devUser.name ?? "Maulik Pandey",
          sessionVersion: devUser.sessionVersion,
        };
      }

      // For standard credentials login, password is required
      if (!password || typeof password !== "string") {
        return null;
      }

      try {
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          return null;
        }

        // Account was created via Google OAuth only without a password
        if (!user.passwordHash) {
          return null;
        }

        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          sessionVersion: user.sessionVersion,
        };
      } catch (dbError: unknown) {
        const msg = dbError instanceof Error ? dbError.message : String(dbError);
        logger.warn("[Auth] Database error during credentials authorization", { error: msg });
        return null;
      }
    },
  }),
];

// Add Google OAuth Provider only if credentials are configured
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile",
          prompt: "select_account",
        },
      },
    })
  );
}

export const authOptions: NextAuthOptions = {
  secret: getAuthSecret(),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  providers,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = profile?.email?.toLowerCase().trim() || user?.email?.toLowerCase().trim();
        if (!email) {
          logger.warn("[Google OAuth] Sign-in rejected: missing email in profile");
          return false;
        }

        // Enforce Google email_verified flag: Never merge or authenticate unverified email
        const isVerified = (profile as { email_verified?: boolean })?.email_verified ?? true;
        if (!isVerified) {
          logger.warn("[Google OAuth] Sign-in rejected: unverified email by provider", { email });
          return false;
        }

        try {
          // Check if provider account is already linked
          const existingAccount = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: "google",
                providerAccountId: account.providerAccountId,
              },
            },
          });

          // Look up user by email
          const existingUser = await prisma.user.findUnique({
            where: { email },
          });

          if (existingAccount) {
            // If the account is linked to a different user, block account collision
            if (existingUser && existingAccount.userId !== existingUser.id) {
              logger.error("[Google OAuth] Account collision detected", {
                email,
                accountId: existingAccount.id,
              });
              return false;
            }

            // Valid existing linked account: ensure emailVerified is populated
            if (existingUser && !existingUser.emailVerified) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: { emailVerified: new Date() },
              });
            }

            user.id = existingAccount.userId;
            (user as { sessionVersion?: number }).sessionVersion = existingUser?.sessionVersion ?? 1;
            return true;
          }

          if (existingUser) {
            // Safe linking: associate the Google identity with the existing user
            await prisma.account.create({
              data: {
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                refresh_token: account.refresh_token,
                access_token: account.access_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state as string | undefined,
              },
            });

            if (!existingUser.emailVerified || (!existingUser.avatarUrl && profile?.image)) {
              await prisma.user.update({
                where: { id: existingUser.id },
                data: {
                  emailVerified: existingUser.emailVerified || new Date(),
                  avatarUrl: existingUser.avatarUrl || profile?.image || null,
                },
              });
            }

            user.id = existingUser.id;
            (user as { sessionVersion?: number }).sessionVersion = existingUser.sessionVersion;
            return true;
          }

          // New user signing up via Google
          const newUser = await prisma.user.create({
            data: {
              email,
              name: profile?.name || user.name || email.split("@")[0],
              avatarUrl: (profile as { picture?: string; image?: string })?.picture || profile?.image || null,
              emailVerified: new Date(),
              sessionVersion: 1,
            },
          });

          await prisma.account.create({
            data: {
              userId: newUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              refresh_token: account.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state as string | undefined,
            },
          });

          user.id = newUser.id;
          (user as { sessionVersion?: number }).sessionVersion = newUser.sessionVersion;
          return true;
        } catch (linkError: unknown) {
          const msg = linkError instanceof Error ? linkError.message : String(linkError);
          logger.error("[Google OAuth] Account linking failed", { error: msg });
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 1;
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
    error: "/login",
  },
};
