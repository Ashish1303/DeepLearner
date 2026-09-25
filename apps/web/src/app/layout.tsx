import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../lib/env';
import './globals.css';

export const metadata: Metadata = {
  title: 'DeepLearner',
  description: 'Understand it. Visualize it. Practice it. Remember it.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
