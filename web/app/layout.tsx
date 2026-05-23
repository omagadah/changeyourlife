import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { SmoothScroll } from '@/components/SmoothScroll';

// Typo éditoriale : un serif humaniste chaud (Fraunces) pour les titres —
// ce qui « humanise » et casse le côté template. Inter neutre pour le texte.
const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  axes: ['opsz'],
});
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'ChangeYourLife.ai — Construis la meilleure version de toi-même',
  description:
    "Ta vie devient un arbre vivant qui grandit avec toi, guidé par Lya, ton coach IA. Corps, mental, relations, sens — chaque dimension prend racine et s'épanouit.",
  metadataBase: new URL('https://changeyourlife.ai'),
  openGraph: {
    title: 'ChangeYourLife.ai — Construis la meilleure version de toi-même',
    description: 'Ta vie devient un arbre vivant qui grandit avec toi, guidé par Lya, ton coach IA.',
    url: 'https://changeyourlife.ai',
    locale: 'fr_FR',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#060e1a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <SmoothScroll>{children}</SmoothScroll>
        {/* grain global — texture analogique très subtile par-dessus tout */}
        <div className="grain" aria-hidden />
      </body>
    </html>
  );
}
