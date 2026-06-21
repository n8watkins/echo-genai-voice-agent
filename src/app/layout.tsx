import type { Metadata, Viewport } from 'next';
import './globals.css';
import Providers from '@/components/Providers';

const title = 'Echo — Realtime Voice Agent';
const description =
  'Talk to an AI and it talks back — in real time, interruptible, with tools. A portfolio project by Nathan Watkins.';

// Canonical URL for OG / share cards. Override with NEXT_PUBLIC_APP_URL (e.g. a
// future custom domain); defaults to the live Render deploy so previews resolve.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://echo-kzw1.onrender.com';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    url: appUrl,
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
