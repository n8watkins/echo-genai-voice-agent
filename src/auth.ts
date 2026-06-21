import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';

/**
 * Auth.js (NextAuth v5) — GitHub sign-in.
 *
 * Optional like everything else here: if AUTH_GITHUB_ID / AUTH_GITHUB_SECRET
 * aren't set, the provider list is empty and Echo runs signed-out (in-memory,
 * no persistence). Auth only gates "save my conversations" — it's never
 * required to use the app.
 *
 * `trustHost` is on because we deploy behind Render's proxy (a non-Vercel
 * host). `session.user.id` is surfaced from the JWT subject so the persistence
 * layer has a stable per-user owner id.
 */
export const githubConfigured = Boolean(
  process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
);

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: githubConfigured ? [GitHub] : [],
  callbacks: {
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
