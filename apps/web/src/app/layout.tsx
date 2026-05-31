import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/Header';

export const metadata: Metadata = {
  title: 'Manhattan Vibes',
  description: 'Order pizza, burgers & more — direct from Manhattan Vibes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-full">
        <Providers>
          <Header />
          <main className="min-h-[calc(100vh-64px)]">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
