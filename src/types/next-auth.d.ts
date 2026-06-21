import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /** Surface a stable per-user id on the session for the persistence layer. */
  interface Session {
    user: {
      id?: string;
    } & DefaultSession['user'];
  }
}
