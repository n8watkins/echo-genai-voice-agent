import type { Metadata } from 'next';
import './globals.css';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
