'use client';

import { useEffect, useRef, useState } from 'react';

// YouTube titles include HTML entities; decode as text, never insert remote HTML.
function decode(text) {
  if (typeof document === 'undefined') return text;
  const area = document.createElement('textarea');
  area.innerHTML = text;
  return area.value;
}

export default function YoutubeKaraoke() {
  const [query, setQuery] = useState(''), [searched, setSearched] = useState('');
  const [items, setItems] = useState([]), [nextPage, setNextPage] = useState('');
  const [current, setCurrent] = useState(null), [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Nhập tên bài, có thể thêm ca sĩ, tone nam hoặc tone nữ.');
  const [voiceReady, setVoiceReady] = useState(false), [listening, setListening] = useState(false);
  const controller = useRef(null), serial = useRef(0), recognition = useRef(null), player = useRef(null);
  const debounce = useRef(null), composing = useRef(false);
  useEffect(() => {
    setVoiceReady(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      clearTimeout(debounce.current); serial.current++; controller.current?.abort();
      if (recognition.current) { recognition.current.onend = null; recognition.current.onresult = null; recognition.current.onerror = null; recognition.current.abort(); }
    };
  }, []);
  function edit(text, autoSearch = true) {
    clearTimeout(debounce.current);
    serial.current++; controller.current?.abort(); setLoading(false);
    setQuery(text); setItems([]); setNextPage(''); setSearched('');
    setStatus(text.trim() ? `Đang nhập “${text.trim()}”…` : 'Nhập tên bài để tự động tìm karaoke.');
    if (autoSearch && text.trim() && !composing.current) debounce.current = setTimeout(() => search(text), 1000);
  }
  async function search(text, page = '') {
    clearTimeout(debounce.current);
    text = text.trim();
    if (!text || composing.current) return;
    controller.current?.abort();
    const request = new AbortController(), id = ++serial.current;
    controller.current = request;
    setLoading(true); setStatus('Đang tìm karaoke trên YouTube…');
    if (!page) { setItems([]); setNextPage(''); setSearched(text); }
    try {
      const response = await fetch(`/api/youtube/search?${new URLSearchParams({ q: text, ...(page ? { page } : {}) })}`, { signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không tìm được trên YouTube.');
      if (id !== serial.current) return;
      setItems(old => [...new Map([...(page ? old : []), ...data.items].map(item => [item.id, item])).values()]);
      setNextPage(data.nextPage);
      setStatus(data.items.length ? `Karaoke cho “${text}” · Chọn video phù hợp với tone của bạn.` : 'Không có thêm video phù hợp. Thử tên bài hoặc ca sĩ khác.');
    } catch (error) {
      if (id === serial.current) setStatus(error.name === 'AbortError' ? 'Đã dừng tìm kiếm.' : error.message);
    } finally { if (id === serial.current) setLoading(false); }
  }
  function toggleVoice() {
    if (listening) { recognition.current?.stop(); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const voice = new Recognition();
    voice.lang = 'vi-VN'; voice.interimResults = true;
    let heard = '', failed = false;
    voice.onresult = event => {
      heard = Array.from(event.results, result => result[0].transcript).join(' ').replace(/[.,!?;:…"“”]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
      edit(heard, false);
    };
    voice.onerror = event => { failed = true; setStatus(event.error === 'not-allowed' ? 'Hãy cho phép truy cập micro rồi thử lại.' : 'Chưa nhận được giọng nói. Hãy thử lại hoặc gõ tên bài.'); };
    voice.onend = () => { setListening(false); if (heard && !failed) search(heard); };
    recognition.current = voice;
    try { voice.start(); setListening(true); setStatus('Đang nghe tên bài karaoke…'); }
    catch { setStatus('Chưa bật được micro. Hãy thử lại.'); }
  }
  return <section className="youtube-karaoke" aria-label="YouTube Karaoke">
    <form role="search" onSubmit={event => { event.preventDefault(); recognition.current?.abort(); search(query); }}>
      <label htmlFor="youtube-query" className="search-label">Tự động tìm karaoke khi ngừng gõ.</label>
      <div className="search-field"><input id="youtube-query" type="search" required maxLength={150} value={query} onChange={event => edit(event.target.value)} onCompositionStart={() => { composing.current = true; clearTimeout(debounce.current); serial.current++; controller.current?.abort(); setLoading(false); }} onCompositionEnd={event => { composing.current = false; edit(event.currentTarget.value); }} placeholder="Tên bài, ca sĩ, tone nam/nữ…" autoComplete="off" />
        {voiceReady && <button type="button" className={`voice ${listening ? 'listening' : ''}`} aria-label={listening ? 'Dừng nghe' : 'Tìm bằng giọng nói'} aria-pressed={listening} onClick={toggleVoice}>🎤</button>}
      </div>
      <div className="search-actions"><button className="outline" disabled={loading || !query.trim() || listening}>Tìm karaoke</button><button type="button" className="outline" onClick={() => edit('')}>Xóa từ khóa</button></div>
    </form>
    <p role="status" aria-live="polite">{status}</p>
    {current && <section className="youtube-player" ref={player} aria-label="Video đang chọn">
      <div className="youtube-player-actions"><h2>{decode(current.title)}</h2><button className="outline" onClick={() => setCurrent(null)}>Đóng video</button></div>
      <iframe key={current.id} src={`https://www.youtube.com/embed/${current.id}`} title={decode(current.title)} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      <p>Bấm phát trong video. Nếu không phát được, <a href={`https://www.youtube.com/watch?v=${current.id}`} target="_blank" rel="noopener noreferrer">mở trên YouTube ↗</a>.</p>
    </section>}
    <div className="youtube-results" aria-busy={loading}>{items.map(item => <button className="youtube-result" key={item.id} aria-pressed={current?.id === item.id} onClick={() => { setCurrent(item); requestAnimationFrame(() => player.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }}>
      <img src={item.thumbnail} alt="" loading="lazy" width="320" height="180" /><span><strong>{decode(item.title)}</strong><small>{decode(item.channel)} · YouTube</small><span>▶ Chọn video</span></span>
    </button>)}</div>
    {nextPage && <button className="outline" disabled={loading} onClick={() => search(searched, nextPage)}>Xem thêm video</button>}
  </section>;
}
