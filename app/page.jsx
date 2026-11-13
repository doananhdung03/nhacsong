import LyricsWorkspace from '../components/lyrics-workspace';

export default function Home() {
  return <>
    <header className="topbar"><div className="page-width"><a href="/" className="brand">NHẠC SỐNG</a><span>Tìm lời & trình chiếu</span></div></header>
    <main>
      <h1>ÂM THANH NHẠC SỐNG HỒNG LÂM</h1>
      <p className="notice">Tìm lời bài hát và trình chiếu chữ lớn dành cho buổi biểu diễn.</p>
      <LyricsWorkspace />
    </main>
    <footer><div className="page-width"><strong>NHẠC SỐNG</strong><span>Dữ liệu từ LRCLIB · Bài lưu chỉ trên trình duyệt này</span></div></footer>
  </>;
}
