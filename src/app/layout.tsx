import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/components/Providers';

const title = 'Echo — Realtime Voice Agent';
const description =
  'Talk to an AI and it talks back — in real time, interruptible, with tools. A portfolio project by Nathan Watkins.';

export const metadata: Metadata = {
  metadataBase: new URL('https://portfolio.n8builds.dev/echo'),
  title,
  description,
  openGraph: {
    title,
    description,
    url: 'https://portfolio.n8builds.dev/echo',
    siteName: 'Echo',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
  },
};

// Mobile viewport: lock to device width, allow pinch-zoom (accessibility),
// and extend under iOS browser chrome / safe areas so the dvh-based shell can
// use the full screen and honour env(safe-area-inset-*).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
