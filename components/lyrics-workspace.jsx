'use client';

import { useEffect, useRef, useState } from 'react';
import { durationLabel, normalizeSearch, plainText, prioritizeVietnamese, validTrack } from '../lib/lyrics.mjs';
import Presentation from './presentation';
import useAutoScroll from './use-auto-scroll';

const storageKey = 'loi.saved.v1';

export default function LyricsWorkspace() {
  const [query, setQuery] = useState(''), [results, setResults] = useState([]), [saved, setSaved] = useState([]);
  const [current, setCurrent] = useState(null), [savedView, setSavedView] = useState(false);
  const [loading, setLoading] = useState(false), [status, setStatus] = useState('Nhập từ 1 ký tự để tự động tìm bài hát.');
  const [size, setSize] = useState(24), [speed, setSpeed] = useState(25), [presenting, setPresenting] = useState(false);
  const controller = useRef(null), serial = useRef(0), viewport = useRef(null), reader = useRef(null), presentButton = useRef(null);
  const debounce = useRef(null), composing = useRef(false);
  const queryInput = useRef(null);
  const scroll = useAutoScroll(viewport, speed);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) setSaved(stored.filter(validTrack));
    } catch { setStatus('Không đọc được bài đã lưu. Bạn vẫn có thể tìm và trình chiếu.'); }
    return cancelSearch;
  }, []);

  function cancelSearch() {
    clearTimeout(debounce.current);
    serial.current++;
    controller.current?.abort();
  }
  function changeQuery(text) {
    cancelSearch(); setQuery(text); setSavedView(false); setLoading(false); setResults([]);
    if (!normalizeSearch(text)) {
      setStatus('Nhập từ 1 ký tự để tự động tìm bài hát.');
      return;
    }
    setStatus(`Đang nhập “${text.trim()}”…`);
    if (!composing.current) debounce.current = setTimeout(() => search(text), 350);
  }
  async function search(text) {
    cancelSearch();
    text = normalizeSearch(text); if (!text || composing.current) return;
    setSavedView(false); setLoading(true); setStatus(`Đang tìm “${text}”…`);
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
      const tracks = prioritizeVietnamese(data.filter(validTrack)); setResults(tracks);
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
    scroll.stop(); setCurrent(track); setPresenting(true);
    enterFullscreen();
    if (viewport.current) viewport.current.scrollTop = 0;
    requestAnimationFrame(() => reader.current?.scrollIntoView({ block: 'start' }));
  }
  function enterFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function toggleSaved() {
    if (!current) return;
    const next = saved.some(track => track.id === current.id) ? saved.filter(track => track.id !== current.id) : [...saved, current];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setSaved(next); }
    catch { setStatus('Không lưu được trên trình duyệt này. Có thể bộ nhớ đã đầy hoặc đang bị chặn.'); }
  }
  function closePresentation() { setPresenting(false); requestAnimationFrame(() => presentButton.current?.focus()); }
  const tracks = savedView ? saved : results;
  return <>
    <section className="workspace" aria-label="Thư viện lời bài hát">
      <div className="library">
        <form role="search" onSubmit={event => { event.preventDefault(); search(query); }}><label htmlFor="query" className="search-label">Nhập tên bài hát hoặc ca sĩ. Tự động tìm từ 1 ký tự.</label><input ref={queryInput} id="query" type="search" minLength={1} maxLength={150} placeholder="Nhập tên bài hát…" required autoComplete="off" value={query} onChange={event => changeQuery(event.target.value)} onCompositionStart={() => { composing.current = true; cancelSearch(); setLoading(false); }} onCompositionEnd={event => { composing.current = false; changeQuery(event.currentTarget.value); }} /><div className="search-actions"><button className="outline" type="submit" disabled={loading || query.trim().length < 1}>Tìm bài hát</button><button className="outline" type="button" onClick={() => { changeQuery(''); queryInput.current?.focus(); }}>Xóa từ khóa</button></div></form>
        <div className="tabs" role="group" aria-label="Chọn danh sách"><button className={`tab ${savedView ? '' : 'active'}`} aria-pressed={!savedView} onClick={() => setSavedView(false)}>Kết quả tìm kiếm</button><button className={`tab ${savedView ? 'active' : ''}`} aria-pressed={savedView} onClick={() => setSavedView(true)}>Bài đã lưu <span>{saved.length}</span></button></div>
        <p id="status" role="status" aria-live="polite">{savedView ? `${saved.length} bài đã lưu trên trình duyệt này.` : status}</p>
        <div className="results" aria-busy={!savedView && loading}>
          {tracks.map(track => <button key={track.id} className={`result ${current?.id === track.id ? 'selected' : ''}`} aria-pressed={current?.id === track.id} onClick={() => selectTrack(track)}><strong>{track.trackName}</strong><span className="lyric-preview">{plainText(track).replace(/\s+/g, ' ').slice(0, 180) || 'Chưa có lời cho bản thu này.'}</span><span><b>Ca sĩ:</b> {track.artistName}</span>{track.albumName && <span><b>Album:</b> {track.albumName}</span>}{durationLabel(track.duration) && <span className="duration">Thời lượng: {durationLabel(track.duration)}</span>}</button>)}
          {savedView && !tracks.length && <p className="empty">Chưa có bài đã lưu. Chọn một bài và nhấn “Lưu bài”.</p>}
        </div>
      </div>
      <section className="reader" ref={reader} aria-label="Lời bài hát" hidden={!current}>
        {current ? <div><div className="song-meta"><h2>{current.trackName}</h2><p>{current.artistName}</p>{current.albumName && <p id="song-album">Album: {current.albumName}</p>}<div className="song-actions"><button className="outline" onClick={toggleSaved}>{saved.some(track => track.id === current.id) ? '♥ Đã lưu · Bỏ lưu' : '♡ Lưu bài'}</button><button ref={presentButton} className="primary" onClick={() => { scroll.stop(); setPresenting(true); enterFullscreen(); }}>⛶ Trình chiếu</button></div></div>
          <div className="reader-toolbar"><label>Cỡ chữ <input type="range" min="18" max="52" value={size} onChange={event => setSize(Number(event.target.value))} /></label><button className="text-button" aria-pressed={scroll.running} onClick={scroll.toggle}>{scroll.running ? 'Ⅱ Dừng cuộn' : '▷ Tự cuộn'}</button><label>Tốc độ <input type="range" min="10" max="80" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label></div>
          <div ref={viewport} id="lyrics-scroll" tabIndex={0} aria-label="Nội dung lời bài hát" onWheel={scroll.stop} onTouchStart={scroll.stop}><pre id="lyrics" style={{ fontSize: size }}>{plainText(current) || 'Chưa có lời cho bản thu này. Hãy chọn một kết quả khác.'}</pre></div><p className="source-note">Lời từ <a href="https://lrclib.net/" target="_blank" rel="noopener noreferrer">LRCLIB</a> · Có thể khác nhau giữa các bản thu</p>
        </div> : null}
      </section>
    </section>
    {presenting && current && <Presentation track={current} onClose={closePresentation} />}
  </>;
}
