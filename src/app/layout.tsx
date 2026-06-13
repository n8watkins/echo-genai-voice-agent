import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Echo — Realtime Voice Agent',
  description:
    'Talk to an AI and it talks back — in real time, interruptible, with tools. A portfolio project by Nathan Watkins.',
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
