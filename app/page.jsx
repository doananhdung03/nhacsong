import LyricsWorkspace from '../components/lyrics-workspace';

export default function Home() {
  return <>
    <header className="topbar"><div className="page-width"><a href="/" className="brand">ÂM THANH NHẠC SỐNG HỒNG LÂM</a><span>Tìm lời và trình chiếu</span></div></header>
    <main>
      {/* Second copy makes the right-to-left scroll seamless; aria-hidden keeps the heading name single. */}
      <h1 className="marquee" aria-label="ÂM THANH NHẠC SỐNG HỒNG LÂM"><span className="marquee-track"><span>ÂM THANH NHẠC SỐNG HỒNG LÂM</span><span aria-hidden="true">ÂM THANH NHẠC SỐNG HỒNG LÂM</span></span></h1>
      <p className="notice">Gõ tên bài hoặc chữ cái đầu, chọn bài, rồi chiếu lời chữ lớn lên màn hình.</p>
      <LyricsWorkspace />
    </main>
    <footer><div className="page-width"><strong>ÂM THANH NHẠC SỐNG HỒNG LÂM</strong><span>© 2026 | Designed &amp; Developed by DoanAnhDung03 ♡</span></div></footer>
  </>;
}
