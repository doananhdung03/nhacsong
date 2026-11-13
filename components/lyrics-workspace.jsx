'use client';

import { useEffect, useRef, useState } from 'react';
import { durationLabel, plainText, validTrack } from '../lib/lyrics.mjs';
import Presentation from './presentation';
import useAutoScroll from './use-auto-scroll';

const storageKey = 'loi.saved.v1';

export default function LyricsWorkspace() {
  const [query, setQuery] = useState(''), [results, setResults] = useState([]), [saved, setSaved] = useState([]);
  const [current, setCurrent] = useState(null), [savedView, setSavedView] = useState(false);
  const [loading, setLoading] = useState(false), [status, setStatus] = useState('Một bài hát hay đang chờ bạn tìm thấy.');
  const [size, setSize] = useState(24), [speed, setSpeed] = useState(25), [presenting, setPresenting] = useState(false);
  const controller = useRef(null), serial = useRef(0), viewport = useRef(null), reader = useRef(null), presentButton = useRef(null);
  const scroll = useAutoScroll(viewport, speed);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) setSaved(stored.filter(validTrack));
    } catch { setStatus('Không đọc được bài đã lưu. Bạn vẫn có thể tìm và trình chiếu.'); }
    return () => { serial.current++; controller.current?.abort(); };
  }, []);

  async function search(text) {
    text = text.trim(); if (!text) return;
    setQuery(text); setSavedView(false); setLoading(true); setStatus(`Đang tìm “${text}”…`);
    controller.current?.abort();
    const request = new AbortController(), requestId = ++serial.current;
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 20000);
    try {
      const url = new URL('https://lrclib.net/api/search'); url.searchParams.set('q', text);
      const response = await fetch(url, { signal: request.signal, headers: { 'Lrclib-Client': 'LoiWeb/2.0' } });
      if (response.status === 429) throw new Error('Nguồn lời đang giới hạn lượt tìm. Vui lòng thử lại sau một lúc.');
      if (!response.ok) throw new Error('Nguồn lời tạm thời chưa phản hồi. Vui lòng thử lại.');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.');
      if (requestId !== serial.current) return;
      const tracks = data.filter(validTrack); setResults(tracks);
      setStatus(tracks.length ? `${tracks.length} bản thu cho “${text}” · Chọn bản phù hợp với bạn` : `Chưa tìm thấy “${text}”. Thử tên không dấu hoặc thêm tên ca sĩ.`);
    } catch (error) {
      if (requestId !== serial.current) return;
      setResults([]);
      setStatus(error.name === 'AbortError' ? 'Kết nối quá lâu. Vui lòng tìm lại.' : error instanceof TypeError ? 'Không kết nối được nguồn lời. Kiểm tra mạng rồi thử lại.' : error.message);
    } finally {
      clearTimeout(timeout); if (requestId === serial.current) setLoading(false);
    }
  }
  function selectTrack(track) {
    scroll.stop(); setCurrent(track);
    if (viewport.current) viewport.current.scrollTop = 0;
    if (window.matchMedia('(max-width: 850px)').matches) reader.current.scrollIntoView({ block: 'start' });
  }
  function toggleSaved() {
    if (!current) return;
    const next = saved.some(track => track.id === current.id) ? saved.filter(track => track.id !== current.id) : [...saved, current];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); }
    catch { setStatus('Không lưu được trên trình duyệt này. Có thể bộ nhớ đã đầy hoặc đang bị chặn.'); }
  }
  function closePresentation() { setPresenting(false); presentButton.current?.focus(); }
  const tracks = savedView ? saved : results;
  return <>
    <section className="workspace" aria-label="Thư viện lời bài hát">
      <div className="library">
        <form role="search" onSubmit={event => { event.preventDefault(); search(query); }}><label htmlFor="query" className="eyebrow">HÔM NAY BẠN MUỐN HÁT GÌ?</label><div className="search-box"><span aria-hidden="true">⌕</span><input id="query" type="search" maxLength={150} placeholder="Tên bài hát hoặc ca sĩ…" required autoComplete="off" value={query} onChange={event => setQuery(event.target.value)} /><button className="primary" type="submit" disabled={loading}>Tìm bài <span aria-hidden="true">↗</span></button></div></form>
        <div className="suggestions"><span>Thử tìm</span>{['Diễm xưa', 'Nối vòng tay lớn', 'Sơn Tùng M-TP'].map(text => <button key={text} onClick={() => search(text)}>{text}</button>)}</div>
        <div className="tabs" role="group" aria-label="Chọn danh sách"><button className={`tab ${savedView ? '' : 'active'}`} aria-pressed={!savedView} onClick={() => setSavedView(false)}>Kết quả tìm kiếm</button><button className={`tab ${savedView ? 'active' : ''}`} aria-pressed={savedView} onClick={() => setSavedView(true)}>Bài đã lưu <span>{saved.length}</span></button></div>
        <p id="status" role="status" aria-live="polite">{savedView ? `${saved.length} bài đã lưu trên trình duyệt này.` : status}</p>
        <div className="results" aria-busy={!savedView && loading}>
          {tracks.length ? tracks.map(track => <button key={track.id} className={`result ${current?.id === track.id ? 'selected' : ''}`} aria-pressed={current?.id === track.id} onClick={() => selectTrack(track)}><span className="song-icon">♪</span><span className="result-info"><strong>{track.trackName}</strong><small>{[track.artistName, durationLabel(track.duration)].filter(Boolean).join(' · ')}</small></span><span className="result-badge">{track.instrumental ? 'Không lời' : track.syncedLyrics ? 'Có mốc thời gian' : plainText(track) ? 'Lời bài hát' : 'Chưa có lời'}</span></button>) : <div className="empty"><span className="empty-icon">♫</span><h3>{savedView ? 'Giữ lại những bài bạn yêu' : 'Bắt đầu bằng một giai điệu quen'}</h3><p>{savedView ? 'Mở một bài và chọn “Lưu bài” để thêm vào đây.' : 'Tìm tên bài hoặc ca sĩ để khám phá các bản lời.'}</p></div>}
        </div>
      </div>
      <section className="reader" ref={reader} aria-label="Lời bài hát"><div className="reader-heading"><span className="eyebrow">GÓC TRÌNH DIỄN</span><span className="reader-dot">●</span></div>
        {current ? <div><div className="song-meta"><h2>{current.trackName}</h2><p>{current.artistName}</p>{current.albumName && <p id="song-album">Album: {current.albumName}</p>}<div className="song-actions"><button className="outline" onClick={toggleSaved}>{saved.some(track => track.id === current.id) ? '♥ Đã lưu · Bỏ lưu' : '♡ Lưu bài'}</button><button ref={presentButton} className="primary" onClick={() => { scroll.stop(); setPresenting(true); }}>⛶ Trình chiếu</button></div></div>
          <div className="reader-toolbar"><label>Cỡ chữ <input type="range" min="18" max="52" value={size} onChange={event => setSize(Number(event.target.value))} /></label><button className="text-button" aria-pressed={scroll.running} onClick={scroll.toggle}>{scroll.running ? 'Ⅱ Dừng cuộn' : '▷ Tự cuộn'}</button><label>Tốc độ <input type="range" min="10" max="80" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label></div>
          <div ref={viewport} id="lyrics-scroll" tabIndex={0} aria-label="Nội dung lời bài hát" onWheel={scroll.stop} onTouchStart={scroll.stop}><pre id="lyrics" style={{ fontSize: size }}>{plainText(current) || 'Chưa có lời cho bản thu này. Hãy chọn một kết quả khác.'}</pre></div><p className="source-note">Lời từ <a href="https://lrclib.net/" target="_blank" rel="noopener noreferrer">LRCLIB</a> · Có thể khác nhau giữa các bản thu</p>
        </div> : <div className="reader-empty"><span>“</span><h2>Âm nhạc bắt đầu<br />từ những lời ca.</h2><p>Chọn một bài ở bên trái<br />để mở lời và bắt đầu trình chiếu.</p></div>}
      </section>
    </section>
    {presenting && current && <Presentation track={current} onClose={closePresentation} />}
  </>;
}
