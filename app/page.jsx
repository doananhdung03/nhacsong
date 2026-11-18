import LyricsWorkspace from '../components/lyrics-workspace';
import PromoVideo from '../components/promo-video';
import { site } from '../lib/site.mjs';
import Brand from '../components/brand';

export const metadata = { alternates: { canonical: '/' } };

export default function Home() {
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, alternateName: 'Nhạc Sống Hồng Lâm', url: site.url.href, inLanguage: 'vi-VN', description: site.description }).replace(/</g, '\\u003c') }} />
    <header className="topbar"><div className="page-width"><Brand /><span>Tìm lời và trình chiếu</span></div></header>
    <main>
      {/* Second copy makes the right-to-left scroll seamless; aria-hidden keeps the heading name single. */}
      <h1 className="marquee" aria-label="ÂM THANH NHẠC SỐNG HỒNG LÂM"><span className="marquee-track"><span>ÂM THANH NHẠC SỐNG HỒNG LÂM</span><span aria-hidden="true">ÂM THANH NHẠC SỐNG HỒNG LÂM</span></span></h1>
      <p className="notice">Gõ tên bài hoặc chữ cái đầu, chọn bài, rồi chiếu lời chữ lớn lên màn hình.</p>
      <PromoVideo />
      <LyricsWorkspace />
    </main>
    <footer><div className="page-width"><Brand /><span>© 2026 | Designed &amp; Developed by DoanAnhDung03 ♡</span></div></footer>
  </>;
}
