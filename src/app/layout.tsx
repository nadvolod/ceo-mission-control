import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CEO Mission Control - Nikolay Portfolio',
  description: 'Executive command center for portfolio optimization and focus management',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}