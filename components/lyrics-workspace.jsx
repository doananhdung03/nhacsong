'use client';

import { useEffect, useRef, useState } from 'react';
import { catalogSong, cleanNctLyrics, collapseSameLyrics, splitArtists, durationLabel, fold, isNct, isZing, lyricPreview, nctTrack, songKey, normalizeSearch, plainText, rankTracks, searchCatalog, validTrack, vietnameseScore } from '../lib/lyrics.mjs';
import { addSong, fillPreview, loadSongs, songLyrics } from '../lib/songs-db.mjs';
import Presentation from './presentation';
import useAutoScroll from './use-auto-scroll';

const storageKey = 'loi.saved.v1';
const idleStatus = 'Nhập từ 1 ký tự để tự động tìm bài hát.';

async function lrclibSearch(text, signal) {
  const url = new URL('https://lrclib.net/api/search'); url.searchParams.set('q', text);
  for (let attempt = 1; ; attempt++) {
    try {
      // LRCLIB sometimes stalls 15-20 s while a fresh request answers in ~1 s: cap each try at 8 s and retry once.
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]), headers: { 'Lrclib-Client': 'LoiWeb/2.0' } });
      if (response.status === 429) throw new Error('Nguồn lời đang giới hạn lượt tìm. Vui lòng thử lại sau một lúc.');
      if (!response.ok) throw new Error('Nguồn lời tạm thời chưa phản hồi. Vui lòng thử lại.');
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('Dữ liệu phản hồi không hợp lệ. Vui lòng thử lại.');
      return data.filter(validTrack);
    } catch (error) {
      if (error.name === 'TimeoutError' && attempt < 2 && !signal.aborted) continue;
      throw error;
    }
  }
}
// Lyrics for a catalog song: hand-entered (Supabase) first, else the best LRCLIB match by title, preferring the same artist.
async function resolveSong(song, signal) {
  const stored = await songLyrics(song.key).catch(() => null);
  // Negative id keeps hand-entered songs apart from LRCLIB ids (used by saved songs and selection).
  if (stored) return { id: -stored.id, trackName: song.title, artistName: song.artist, plainLyrics: stored.lyrics };
  const rows = await lrclibSearch(`${song.title} ${song.artist}`, signal), artist = fold(song.artist);
  // Prefer a same-artist version with lyrics; filter before ranking because rankTracks dedupes title|artist.
  const [best] = rankTracks(rows.filter(item => !item.instrumental && fold(item.artistName).includes(artist) && plainText(item)), song.title);
  return best || rankTracks(rows, song.title)[0] || null;
}
const previewCount = 5; // keeps LRCLIB calls per search low (rate limit ~90/min)
// Person icon marks the artist/author line in result rows.
// Person icon + the first singer only; co-singers and other singers of the same lyrics fold into "+N" (full list on hover).
const Artist = ({ name, others = [] }) => {
  const [main = name, ...rest] = splitArtists(name), more = rest.length + others.length;
  const title = more ? [rest.length ? `Ca sĩ: ${name}` : '', others.length ? `Cùng lời với: ${others.join(', ')}` : ''].filter(Boolean).join('\n') : undefined;
  return <span className="artist" title={title}><svg aria-hidden="true" viewBox="0 0 16 16" width="14" height="14"><circle cx="8" cy="5" r="3" fill="currentColor" /><path d="M2 15c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5z" fill="currentColor" /></svg><span className="sr-only">Ca sĩ: {name}{others.length ? `; cùng lời với ${others.join(', ')}` : ''}</span><span aria-hidden="true">{main}{more > 0 && <span className="more"> +{more}</span>}</span></span>;
};
// NhacCuaTui: the site's own web API (unofficial, CORS-enabled), searched in parallel with LRCLIB.
const nctApi = (path, signal) => fetch(`https://graph.nhaccuatui.com/api${path}&timestamp=${Date.now()}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
async function nctSearch(text, signal) {
  const response = await nctApi(`/v3/search/all?keyword=${encodeURIComponent(text)}&correct=false`, signal);
  if (!response.ok) return [];
  const data = await response.json();
  return data?.code === 0 && Array.isArray(data.data?.songs) ? data.data.songs.map(nctTrack).filter(Boolean) : [];
}
async function nctLyrics(track, signal) {
  const response = await nctApi(`/v1/song/lyric/detail?songKey=${encodeURIComponent(track.nctKey)}`, signal);
  if (!response.ok) throw new Error('NhacCuaTui tạm thời chưa phản hồi. Vui lòng thử lại.');
  const data = await response.json();
  return data?.code === 0 && typeof data.data?.content === 'string' ? cleanNctLyrics(data.data.content) : '';
}
async function zingApi(path, params, signal) {
  const response = await fetch(`/api/zing/${path}?${new URLSearchParams(params)}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(12000)]) });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Zing MP3 tạm thời chưa phản hồi.');
    error.status = response.status;
    throw error;
  }
  return data;
}
const sourceBadge = track => isZing(track) ? <span className="source zing">Zing MP3</span> : isNct(track) ? <span className="source nct">NhacCuaTui</span> : <span className="source">LRCLIB</span>;
const errorMessage = error => ['AbortError', 'TimeoutError'].includes(error.name) ? 'Kết nối quá lâu. Vui lòng tìm lại.' : error instanceof TypeError ? 'Không kết nối được nguồn lời. Kiểm tra mạng rồi thử lại.' : error.message;

export default function LyricsWorkspace() {
  const [query, setQuery] = useState(''), [results, setResults] = useState([]), [saved, setSaved] = useState([]);
  const [current, setCurrent] = useState(null), [savedView, setSavedView] = useState(false);
  const [nct, setNct] = useState([]); // NhacCuaTui results for the current query
  const [zing, setZing] = useState([]), [zingError, setZingError] = useState('');
  const [nctText, setNctText] = useState({}); // NCT track id -> lyrics ('' = none), fetched with the search
  const [catalog, setCatalog] = useState([]), [resolved, setResolved] = useState({}); // song key -> track | null
  const [loading, setLoading] = useState(false), [status, setStatus] = useState(idleStatus);
  const [size, setSize] = useState(24), [speed, setSpeed] = useState(25), [presenting, setPresenting] = useState(false);
  const controller = useRef(null), serial = useRef(0), viewport = useRef(null), reader = useRef(null), presentButton = useRef(null);
  const debounce = useRef(null), composing = useRef(false);
  const queryInput = useRef(null);
  const zingLyricsCache = useRef(new Map());
  const scroll = useAutoScroll(viewport, speed);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (Array.isArray(stored)) setSaved(stored.filter(validTrack));
    } catch { setStatus('Không đọc được bài đã lưu. Bạn vẫn có thể tìm và trình chiếu.'); }
    // Only report a failed catalog load if no search has replaced the idle message yet.
    loadSongs().then(setCatalog).catch(() => setStatus(text => text === idleStatus ? 'Không tải được danh sách bài. Vẫn có thể tìm trên LRCLIB.' : text));
    return cancelSearch;
  }, []);

  function cancelSearch() {
    clearTimeout(debounce.current);
    serial.current++;
    controller.current?.abort();
  }
  function changeQuery(text) {
    cancelSearch(); setQuery(text); setSavedView(false); setLoading(false); setResults([]); setNct([]); setZing([]); setZingError('');
    if (!normalizeSearch(text)) {
      setStatus(idleStatus);
      return;
    }
    setStatus(`Đang nhập “${text.trim()}”…`);
    if (!composing.current) debounce.current = setTimeout(() => search(text), 350);
  }
  async function loadZingLyrics(track, signal) {
    if (zingLyricsCache.current.has(track.zingId)) return zingLyricsCache.current.get(track.zingId);
    let text;
    try {
      const data = await zingApi('lyrics', { id: track.zingId }, signal);
      if (typeof data.plainLyrics !== 'string') throw new Error('Lời Zing MP3 không hợp lệ.');
      text = data.plainLyrics.trim();
    } catch (error) {
      if (error.status !== 404) throw error;
      text = '';
    }
    if (zingLyricsCache.current.size >= 100) zingLyricsCache.current.delete(zingLyricsCache.current.keys().next().value);
    zingLyricsCache.current.set(track.zingId, text);
    return text;
  }
  async function search(text) {
    cancelSearch();
    text = normalizeSearch(text); if (!text || composing.current) return;
    setSavedView(false); setLoading(true); setStatus(`Đang tìm “${text}”…`);
    const request = new AbortController(), requestId = ++serial.current;
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 20000);
    setZingError('');
    zingApi('search', { q: text }, request.signal).then(async list => {
      if (requestId !== serial.current || !Array.isArray(list)) return;
      const rows = rankTracks(list.filter(validTrack), text).slice(0, 20);
      setZing(rows);
      // Three workers keep previews responsive without sending twenty lyric requests at once.
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(3, rows.length) }, async () => {
        while (cursor < rows.length && requestId === serial.current && !request.signal.aborted) {
          const track = rows[cursor++];
          try {
            const plainLyrics = await loadZingLyrics(track, request.signal);
            if (requestId === serial.current) setZing(items => items.map(item => item.id === track.id ? { ...item, plainLyrics, previewStatus: plainLyrics ? 'ready' : 'missing' } : item));
          } catch {
            if (requestId === serial.current && !request.signal.aborted) setZing(items => items.map(item => item.id === track.id ? { ...item, previewStatus: 'error' } : item));
          }
        }
      }));
    }).catch(() => { if (requestId === serial.current && !request.signal.aborted) setZingError('Zing MP3 tạm thời chưa phản hồi. Các nguồn khác vẫn hoạt động.'); });
    // Runs alongside LRCLIB and shows as soon as it answers. NCT "search all" also matches loosely,
    // so keep rows whose title or artist contains the query; failures just leave the group empty.
    nctSearch(text, request.signal).then(list => {
      const q = fold(text);
      const shown = rankTracks(list.filter(track => fold(`${track.trackName} ${track.artistName}`).includes(q)), text).slice(0, 10);
      if (requestId !== serial.current) return;
      setNct(shown);
      // NCT lyric lookups answer in milliseconds, so fetch all shown rows at once for previews and same-lyrics merging.
      for (const track of shown) {
        if (track.id in nctText) continue;
        nctLyrics(track, request.signal).then(lyrics => setNctText(map => ({ ...map, [track.id]: lyrics }))).catch(() => {});
      }
    }).catch(() => {});
    try {
      const data = await lrclibSearch(text, request.signal);
      if (requestId !== serial.current) return;
      const tracks = rankTracks(data, text); setResults(tracks);
      setStatus(tracks.length ? `${tracks.length} bản thu cho “${text}” · Chọn bản phù hợp với bạn` : `Chưa tìm thấy “${text}”. Thử tên không dấu hoặc thêm tên ca sĩ.`);
      // Lyric previews for the top catalog matches, one at a time; failures (e.g. 429) just leave no preview.
      setLoading(false);
      for (const song of searchCatalog(catalog, text, previewCount)) {
        if (requestId !== serial.current) return;
        if (song.preview || song.key in resolved) continue; // stored previews need no LRCLIB call
        const track = await resolveSong(song, request.signal).catch(() => undefined);
        if (track !== undefined && requestId === serial.current) setResolved(map => ({ ...map, [song.key]: track }));
      }
    } catch (error) {
      if (requestId !== serial.current) return;
      setResults([]);
      setStatus(errorMessage(error));
    } finally {
      clearTimeout(timeout); if (requestId === serial.current) setLoading(false);
    }
  }
  // Fetch lyrics for a result, then hand the track to `done` unless a newer action superseded this one.
  async function openWith(title, load, done) {
    cancelSearch(); setLoading(true); setStatus(`Đang lấy lời “${title}”…`);
    const request = new AbortController(), requestId = ++serial.current;
    controller.current = request;
    const timeout = setTimeout(() => request.abort(), 20000);
    try {
      const track = await load(request.signal);
      if (requestId !== serial.current) return;
      done(track);
      setStatus(track ? `Đã mở “${track.trackName}”.` : `Chưa tìm thấy lời cho “${title}”.`);
    } catch (error) {
      if (requestId === serial.current) setStatus(errorMessage(error));
    } finally {
      clearTimeout(timeout); if (requestId === serial.current) setLoading(false);
    }
  }
  const openSong = song => openWith(song.title,
    signal => song.key in resolved ? Promise.resolve(resolved[song.key]) : resolveSong(song, signal),
    track => { setResolved(map => ({ ...map, [song.key]: track })); savePreview(song, track); if (track) selectTrack(track, false); });
  const openNct = item => openWith(item.trackName,
    async signal => { const lyrics = item.id in nctText ? nctText[item.id] : await nctLyrics(item, signal); return lyrics ? { ...item, plainLyrics: lyrics } : null; },
    track => { if (track) selectTrack(track); });
  function collect(track) {
    // Auto-collect only likely Vietnamese songs (accented title or Vietnamese lyrics).
    if (vietnameseScore(track) < 3) return;
    const song = catalogSong(track.trackName, track.artistName);
    if (!song.initials) return;
    const existing = catalog.find(item => item.key === song.key);
    if (existing) { savePreview(existing, track); return; }
    const row = { ...song, preview: lyricPreview(plainText(track)) || null };
    addSong(row).then(() => setCatalog(list => list.some(item => item.key === row.key) ? list : [...list, row])).catch(() => {});
  }
  const openZing = item => openWith(item.trackName,
    async signal => {
      if (plainText(item)) return item;
      const plainLyrics = await loadZingLyrics(item, signal);
      return plainLyrics ? { ...item, plainLyrics } : null;
    },
    track => { if (track) { setZing(list => list.map(row => row.id === track.id ? track : row)); selectTrack(track); } });
  // Fill an empty catalog preview from an opened LRCLIB track (RLS only allows writing a null preview).
  function savePreview(song, track) {
    const preview = track && track.id > 0 ? lyricPreview(plainText(track)) : '';
    if (song.preview || !preview || track.instrumental) return;
    fillPreview(song.key, preview).then(() => setCatalog(list => list.map(item => item.key === song.key ? { ...item, preview } : item))).catch(() => {});
  }
  function selectTrack(track, fromLrclib = true) {
    if (fromLrclib) collect(track);
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
  // Hide LRCLIB rows NhacCuaTui already shows (NCT answers first and has proper Vietnamese names).
  const nctKeys = new Set(nct.map(track => songKey(track.trackName, track.artistName)));
  const tracks = savedView ? saved : results.filter(track => !nctKeys.has(songKey(track.trackName, track.artistName)));
  const matches = searchCatalog(catalog, query, 5); // highest-ranked catalog matches; API results keep their own limits
  // One shared map so a LRCLIB row with the same title + lyrics as a Hồng Lâm row is folded into it too.
  const sameLyrics = new Map();
  const shownMatches = savedView ? [] : collapseSameLyrics(matches, song => song.title, song => song.artist,
    song => song.preview || (resolved[song.key] ? plainText(resolved[song.key]) : ''), sameLyrics);
  const shownNct = savedView ? [] : collapseSameLyrics(nct, track => track.trackName, track => track.artistName, track => nctText[track.id] || '', sameLyrics);
  const shownZing = savedView ? [] : collapseSameLyrics(zing, track => track.trackName, track => track.artistName, plainText, sameLyrics);
  const shownTracks = savedView ? tracks.map(item => ({ item, others: [] }))
    : collapseSameLyrics(tracks, track => track.trackName, track => track.artistName, plainText, sameLyrics);
  return <>
    <section className="workspace" aria-label="Thư viện lời bài hát">
      <div className="library">
        <form role="search" onSubmit={event => { event.preventDefault(); search(query); }}><label htmlFor="query" className="search-label">Nhập tên bài hát hoặc ca sĩ. Tự động tìm từ 1 ký tự.</label><input ref={queryInput} id="query" type="search" minLength={1} maxLength={150} placeholder="Nhập tên bài hát…" required autoComplete="off" value={query} onChange={event => changeQuery(event.target.value)} onCompositionStart={() => { composing.current = true; cancelSearch(); setLoading(false); }} onCompositionEnd={event => { composing.current = false; changeQuery(event.currentTarget.value); }} /><div className="search-actions"><button className="outline" type="submit" disabled={loading || query.trim().length < 1}>Tìm bài hát</button><button className="outline" type="button" onClick={() => { changeQuery(''); queryInput.current?.focus(); }}>Xóa từ khóa</button></div></form>
        <div className="tabs" role="group" aria-label="Chọn danh sách"><button className={`tab ${savedView ? '' : 'active'}`} aria-pressed={!savedView} onClick={() => setSavedView(false)}>Kết quả tìm kiếm</button><button className={`tab ${savedView ? 'active' : ''}`} aria-pressed={savedView} onClick={() => setSavedView(true)}>Bài đã lưu <span>{saved.length}</span></button></div>
        <p id="status" role="status" aria-live="polite">{savedView ? `${saved.length} bài đã lưu trên trình duyệt này.` : status}</p>
        <div className="results" aria-busy={!savedView && loading}>
          {shownMatches.length > 0 && <p className="group-label">Danh sách Hồng Lâm · tìm theo chữ cái đầu</p>}
          {shownMatches.map(({ item: song, others }) => <button key={`song-${song.key}`} className="result catalog" onClick={() => openSong(song)}><strong>{song.title}</strong><Artist name={song.artist} others={others} />{(song.preview || song.key in resolved) && <span className="lyric-preview">{song.preview || (resolved[song.key] ? lyricPreview(plainText(resolved[song.key])) || 'Chưa có lời cho bản thu này.' : 'Chưa có lời trên LRCLIB. Có thể tự nhập ở trang quản lý.')}</span>}</button>)}
          {shownNct.length > 0 && <p className="group-label">Từ NhacCuaTui</p>}
          {shownNct.map(({ item: track, others }) => <button key={track.id} className={`result ${current?.id === track.id ? 'selected' : ''}`} aria-pressed={current?.id === track.id} onClick={() => openNct(track)}><strong>{track.trackName}{sourceBadge(track)}</strong><Artist name={track.artistName} others={others} />{track.id in nctText && <span className="lyric-preview">{lyricPreview(nctText[track.id]) || 'Chưa có lời trên NhacCuaTui.'}</span>}<span className="meta">{track.albumName && <span>Album {track.albumName}</span>}{durationLabel(track.duration) && <span>{durationLabel(track.duration)}</span>}</span></button>)}
          {!savedView && zingError && <p className="provider-status" role="status">{zingError}</p>}
          {shownZing.length > 0 && <p className="group-label">Từ Zing MP3</p>}
          {shownZing.map(({item: track, others}) => <button key={track.id} className={`result ${current?.id === track.id ? 'selected' : ''}`} aria-pressed={current?.id === track.id} onClick={() => openZing(track)}><strong>{track.trackName}{sourceBadge(track)}</strong><Artist name={track.artistName} others={others} /><span className="lyric-preview">{plainText(track) ? lyricPreview(plainText(track)) : track.previewStatus === 'missing' ? 'Chưa có lời trên Zing MP3.' : track.previewStatus === 'error' ? 'Chưa tải được đoạn lời. Nhấn để thử lại.' : 'Đang tải đoạn lời…'}</span><span className="meta">{track.albumName && <span>Album {track.albumName}</span>}{durationLabel(track.duration) && <span>{durationLabel(track.duration)}</span>}</span></button>)}
          {!savedView && shownTracks.length > 0 && <p className="group-label">Từ LRCLIB · kho lời trên mạng</p>}
          {shownTracks.map(({ item: track, others }) => <button key={track.id} className={`result ${current?.id === track.id ? 'selected' : ''}`} aria-pressed={current?.id === track.id} onClick={() => selectTrack(track)}><strong>{track.trackName}{track.id > 0 && sourceBadge(track)}</strong><Artist name={track.artistName} others={others} /><span className="lyric-preview">{lyricPreview(plainText(track)) || 'Chưa có lời cho bản thu này.'}</span><span className="meta">{track.albumName && <span>Album {track.albumName}</span>}{durationLabel(track.duration) && <span>{durationLabel(track.duration)}</span>}</span></button>)}
          {savedView && !tracks.length && <p className="empty">Chưa có bài đã lưu. Chọn một bài và nhấn “Lưu bài”.</p>}
        </div>
      </div>
      <section className="reader" ref={reader} aria-label="Lời bài hát" hidden={!current}>
        {current ? <div><div className="song-meta"><h2>{current.trackName}</h2><p>{current.artistName}</p>{current.albumName && <p id="song-album">Album: {current.albumName}</p>}<div className="song-actions"><button className="outline" onClick={toggleSaved}>{saved.some(track => track.id === current.id) ? '♥ Đã lưu · Bỏ lưu' : '♡ Lưu bài'}</button><button ref={presentButton} className="primary" onClick={() => { scroll.stop(); setPresenting(true); enterFullscreen(); }}>⛶ Trình chiếu</button></div></div>
          <div className="reader-toolbar"><label>Cỡ chữ <input type="range" min="18" max="52" value={size} onChange={event => setSize(Number(event.target.value))} /></label><button className="text-button" aria-pressed={scroll.running} onClick={scroll.toggle}>{scroll.running ? 'Ⅱ Dừng cuộn' : '▷ Tự cuộn'}</button><label>Tốc độ <input type="range" min="10" max="80" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label></div>
          <div ref={viewport} id="lyrics-scroll" tabIndex={0} aria-label="Nội dung lời bài hát" onWheel={scroll.stop} onTouchStart={scroll.stop}><pre id="lyrics" style={{ fontSize: size }}>{plainText(current) || 'Chưa có lời cho bản thu này. Hãy chọn một kết quả khác.'}</pre></div><p className="source-note">{current.id < 0 ? 'Lời do Hồng Lâm nhập' : isZing(current) ? <>Lời từ <a href="https://zingmp3.vn/" target="_blank" rel="noopener noreferrer">Zing MP3</a></> : isNct(current) ? <>Lời từ <a href="https://www.nhaccuatui.com/" target="_blank" rel="noopener noreferrer">NhacCuaTui</a></> : <>Lời từ <a href="https://lrclib.net/" target="_blank" rel="noopener noreferrer">LRCLIB</a> · Có thể khác nhau giữa các bản thu</>}</p>
        </div> : null}
      </section>
    </section>
    {presenting && current && <Presentation track={current} onClose={closePresentation} />}
  </>;
}
