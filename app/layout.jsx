import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';
import { site, indexable } from '../lib/site.mjs';

// Self-hosted at build time, so no request to Google from the page (CSP stays 'self').
const font = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '600', '800'], variable: '--font-vn', display: 'swap' });

export const metadata = {
  metadataBase: site.url,
  applicationName: site.name,
  title: { default: site.title, template: '%s | Hồng Lâm' },
  description: site.description,
  authors: [{ name: 'DoanAnhDung03' }],
  creator: 'DoanAnhDung03',
  category: 'music',
  robots: { index: indexable, follow: indexable },
  openGraph: {
    type: 'website', locale: 'vi_VN', siteName: site.name, url: site.url,
    title: site.title, description: site.description,
    images: [{ url: '/social-card.png', width: 1200, height: 630, alt: 'Hồng Lâm – Tìm lời bài hát, trình chiếu và karaoke' }],
  },
  twitter: { card: 'summary_large_image', title: site.title, description: site.description, images: ['/social-card.png'] },
  appleWebApp: { capable: true, title: 'Hồng Lâm', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#004AC6' };

export default function RootLayout({ children }) {
  return <html lang="vi" className={font.variable}><body>{children}</body></html>;
}
