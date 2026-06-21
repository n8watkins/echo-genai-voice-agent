'use client';

import { SessionProvider } from 'next-auth/react';

/** Client-side context providers wrapped around the app (server layout stays a
 *  server component). Currently just the Auth.js session provider. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
