import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';

export const metadata: Metadata = {
  title: 'Manhattan Vibes — Pizza, Burgers & More',
  description: 'Hand-tossed pizza, flame-grilled burgers and uncompromising ingredients. Order delivery or pickup across Saudi Arabia.',
  openGraph: {
    title: 'Manhattan Vibes',
    description: 'Hand-tossed pizza, flame-grilled burgers, delivered hot.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me/" crossOrigin="" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
      </head>
      <body className="min-h-full flex flex-col">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
