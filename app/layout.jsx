import './globals.css';

export const metadata = {
  title: 'Lời • Không gian âm nhạc của bạn',
  description: 'Tìm lời bài hát và trình chiếu chữ lớn cho buổi biểu diễn của bạn.',
};
export const viewport = { themeColor: '#111a17' };

export default function RootLayout({ children }) {
  return <html lang="vi"><body>{children}</body></html>;
}
