import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SmoothScroll } from '@/components/SmoothScroll';

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
    <html lang="fr">
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
