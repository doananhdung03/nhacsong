import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';

// Self-hosted at build time, so no request to Google from the page (CSP stays 'self').
const font = Be_Vietnam_Pro({ subsets: ['vietnamese', 'latin'], weight: ['400', '600', '800'], variable: '--font-vn', display: 'swap' });

export const metadata = {
  title: 'Âm thanh nhạc sống Hồng Lâm',
  description: 'Tìm lời bài hát và trình chiếu chữ lớn cho buổi biểu diễn của bạn.',
};
export const viewport = { themeColor: '#F8F9FF' };

export default function RootLayout({ children }) {
  return <html lang="vi" className={font.variable}><body>{children}</body></html>;
}
