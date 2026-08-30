import NextAuth from "next-auth";
import type { OAuthConfig } from "next-auth/providers";
import { prisma } from "@/lib/prisma";

const oidcProvider: OAuthConfig<Record<string, unknown>> = {
  id: "oidc",
  name: "Continue with your account",
  type: "oidc",
  issuer: process.env.OIDC_ISSUER_URL,
  clientId: process.env.OIDC_CLIENT_ID,
  clientSecret: process.env.OIDC_CLIENT_SECRET,
  authorization: { params: { scope: process.env.OIDC_SCOPE ?? "openid profile email" } },
  profile(profile) {
    return {
      id: String(profile.sub),
      name: typeof profile.name === "string" ? profile.name : null,
      email: typeof profile.email === "string" ? profile.email : null,
      image: typeof profile.picture === "string" ? profile.picture : null,
    };
  },
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: process.env.OIDC_ISSUER_URL ? [oidcProvider] : [],
  pages: { signIn: "/signin" },
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email || !profile?.sub) return false;
      await prisma.user.upsert({
        where: { oidcSubject: String(profile.sub) },
        update: { email: user.email, name: user.name ?? undefined },
        create: { oidcSubject: String(profile.sub), email: user.email, name: user.name },
      });
      return true;
    },
    async jwt({ token, profile }) {
      if (profile?.sub) {
        const dbUser = await prisma.user.findUnique({ where: { oidcSubject: String(profile.sub) }, select: { id: true } });
        if (dbUser) token.sub = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
