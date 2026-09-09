import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://ysabelsociety.com/marketingdata/'),
  title: 'Ysabel Society — Digital Intelligence',
  description: 'The private digital intelligence workspace for Ysabel Society.',
  alternates: { canonical: 'https://ysabelsociety.com/marketingdata' },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Ysabel Society',
    url: 'https://ysabelsociety.com/marketingdata',
    title: 'Ysabel Society — Marketing Data',
    description: 'All platforms. One private workspace.',
    images: [
      {
        url: 'https://ysabelsociety.com/marketingdata/og-square-v76.png',
        secureUrl: 'https://ysabelsociety.com/marketingdata/og-square-v76.png',
        width: 2400,
        height: 2400,
        type: 'image/png',
        alt: 'Ysabel Society — Marketing Data. All platforms. One private workspace.',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Ysabel Society — Marketing Data',
    description: 'All platforms. One private workspace.',
    images: [
      {
        url: 'https://ysabelsociety.com/marketingdata/og-square-v76.png',
        alt: 'Ysabel Society — Marketing Data. All platforms. One private workspace.',
      },
    ],
  },
  manifest: '/marketingdata/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Ysabel Society', statusBarStyle: 'default' },
  robots: { index: false, follow: false },
  icons: {
    icon: '/marketingdata/icons/ysabel-192.png',
    apple: '/marketingdata/icons/ysabel-180.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="silver">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
