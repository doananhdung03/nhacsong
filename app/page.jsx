import LyricsWorkspace from '../components/lyrics-workspace';

export default function Home() {
  return <>
    <header className="topbar"><a className="brand" href="/" aria-label="Lời, trang chủ"><span className="brand-mark">♫</span> lời<span className="brand-dot">.</span></a><span className="top-label">KHÔNG GIAN CHO NGƯỜI YÊU NHẠC</span><span className="live-label"><i /> Sẵn sàng lên sân khấu</span></header>
    <main>
      <section className="intro"><div><p className="eyebrow">MỖI BÀI HÁT, MỘT CÂU CHUYỆN</p><h1>Thuộc lời.<br /><em>Trọn cảm xúc.</em></h1><p className="intro-copy">Tìm bài hát bạn yêu, mở lời thật lớn.<br />Để âm nhạc dẫn lối cho buổi diễn tiếp theo.</p></div><div className="record" aria-hidden="true"><div className="record-inner"><span>lời.</span><small>SIDE A · YOUR NEXT SONG</small></div><span className="record-spark">✦</span></div></section>
      <LyricsWorkspace />
      <footer><span className="brand footer-brand">lời.</span><p>Mang lời ca đến gần hơn.</p><span>Dữ liệu từ LRCLIB · Bài lưu chỉ trên trình duyệt này</span></footer>
    </main>
  </>;
}
