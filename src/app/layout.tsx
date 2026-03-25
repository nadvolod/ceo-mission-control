import type { Metadata } from 'next';
import { Instrument_Serif, DM_Sans } from 'next/font/google';
import './globals.css';

const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  display: 'swap',
  variable: '--font-display',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'CEO Mission Control — Your AI Chief of Staff',
  description: 'The AI-powered executive command center that replaces your spreadsheets, task managers, and status meetings. One interface for priorities, focus hours, finances, and decisions.',
  keywords: ['CEO tools', 'executive AI assistant', 'task management AI', 'focus tracking', 'startup CEO'],
  openGraph: {
    title: 'CEO Mission Control — Your AI Chief of Staff',
    description: 'Stop context switching. Start commanding.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CEO Mission Control',
    description: 'Your AI Chief of Staff',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${dmSans.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
