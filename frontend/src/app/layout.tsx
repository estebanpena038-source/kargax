// =============================================================================
// KargaX - Root Layout
// =============================================================================

import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { ToastContainer } from '@/components/ui/Toast';
import { getConfiguredAppUrl } from '@/lib/server/runtime-env';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'KargaX - Transporte de Carga Inteligente',
    template: '%s | KargaX',
  },
  description:
    'Plataforma premium de logistica, warehouse OS, pagos y control operativo para empresas y transportadores.',
  keywords: [
    'enterprise logistics',
    'warehouse os',
    'wallet settlements',
    'payouts',
    'holding governance',
    'andean logistics',
    'colombia peru ecuador',
  ],
  authors: [{ name: 'KargaX Team' }],
  creator: 'KargaX',
  publisher: 'KargaX',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(getConfiguredAppUrl()),
  openGraph: {
    type: 'website',
    locale: 'es_CO',
    url: '/',
    siteName: 'KargaX',
    title: 'KargaX - Enterprise Logistics, Warehouse and Fintech OS',
    description:
      'Control premium para viajes, bodegas, liquidaciones, tesoreria y gobierno enterprise.',
    images: [
      {
        url: '/kargax-logo.svg',
        width: 1200,
        height: 630,
        alt: 'KargaX - Enterprise Logistics OS',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KargaX - Enterprise Logistics, Warehouse and Fintech OS',
    description: 'Control premium para viajes, bodegas, liquidaciones, tesoreria y gobierno enterprise.',
    images: ['/kargax-logo.svg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/kargax-mark.svg', type: 'image/svg+xml' },
      { url: '/kargax-icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f5ef' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CO"
      className={`${inter.variable} ${jetbrainsMono.variable} ${cormorant.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-screen bg-[var(--color-background)] font-sans antialiased">
        <Providers>
          {children}
          <ToastContainer />
        </Providers>
      </body>
    </html>
  );
}
