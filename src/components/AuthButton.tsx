'use client';

import { useEffect, useState } from 'react';
import { getProviders, signIn, signOut, useSession } from 'next-auth/react';

/**
 * GitHub sign-in / signed-in avatar + sign-out. Signing in is optional — it
 * only unlocks saving conversations; signed-out, Echo works fully in-memory.
 * Renders nothing when sign-in isn't configured (no GitHub provider), so a
 * deploy without AUTH_GITHUB_* never shows a dead button.
 */
export default function AuthButton() {
  const { data: session, status } = useSession();
  const [githubEnabled, setGithubEnabled] = useState(false);

  useEffect(() => {
    getProviders()
      .then((p) => setGithubEnabled(Boolean(p?.github)))
      .catch(() => setGithubEnabled(false));
  }, []);

  if (status === 'loading') {
    return <span className="w-7 h-7 rounded-full bg-white/5 animate-pulse" aria-hidden />;
  }

  // Sign-in not configured and nobody signed in -> render nothing.
  if (!session?.user && !githubEnabled) return null;

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        {session.user.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt={session.user.name ?? 'You'}
            title={session.user.name ?? undefined}
            className="w-7 h-7 rounded-full border border-white/15"
          />
        )}
        <button
          onClick={() => signOut()}
          className="hidden text-xs text-cyan-200/70 transition hover:text-cyan-100 sm:inline"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => signIn('github')}
      title="Sign in with GitHub to save your conversations"
      className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:border-cyan-400/50 hover:bg-cyan-500/10"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 014 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
      </svg>
      <span className="hidden sm:inline">Sign in</span>
    </button>
  );
}
