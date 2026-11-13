'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { lyricSections, plainText } from '../lib/lyrics.mjs';

export default function Presentation({ track, onClose }) {
  const dialog = useRef(null), stage = useRef(null), lyrics = useRef(null);
  const [index, setIndex] = useState(0), [theme, setTheme] = useState('light');
  const [size, setSize] = useState(96), [fullscreen, setFullscreen] = useState(false);
  const [notice, setNotice] = useState('');
  const sections = lyricSections(plainText(track) || 'Chưa có lời cho bản thu này.');
  const total = sections.length + 1;
  const text = index === 0 ? `${track.trackName}\n\n${track.artistName}` : sections[index - 1];

  useEffect(() => {
    const node = dialog.current;
    node.showModal(); stage.current.focus();
    try { if (localStorage.getItem('loi.presentation.theme') === 'dark') setTheme('dark'); } catch {}
    let entered = Boolean(document.fullscreenElement);
    setFullscreen(entered);
    function fullscreenChanged() {
      const active = Boolean(document.fullscreenElement);
      setFullscreen(active);
      if (entered && !active) onClose();
      if (active) entered = true;
    }
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      if (document.fullscreenElement === document.documentElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  useLayoutEffect(() => {
    function fit() {
      const container = stage.current, content = lyrics.current;
      if (!container.clientHeight) return;
      const styles = getComputedStyle(container);
      const height = container.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
      const width = container.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      let low = 12, high = size, best = 12;
      while (low <= high) {
        const candidate = Math.floor((low + high) / 2);
        content.style.fontSize = `${candidate}px`;
        if (content.scrollHeight <= Math.ceil(height) && content.scrollWidth <= Math.ceil(width)) { best = candidate; low = candidate + 1; }
        else high = candidate - 1;
      }
      content.style.fontSize = `${best}px`;
    }
    fit();
    const observer = new ResizeObserver(fit); observer.observe(stage.current);
    return () => observer.disconnect();
  }, [text, size]);

  function move(delta) { setIndex(value => Math.max(0, Math.min(total - 1, value + delta))); }
  function changeTheme(value) {
    setTheme(value);
    try { localStorage.setItem('loi.presentation.theme', value); } catch {}
  }
  function handleKey(event) {
    if (event.code === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.target.tagName === 'INPUT' || (event.code === 'Space' && event.target.tagName === 'BUTTON')) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', 'Space'].includes(event.code)) { event.preventDefault(); move(1); }
    if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.code)) { event.preventDefault(); move(-1); }
    if (event.code === 'Home') { event.preventDefault(); setIndex(0); }
    if (event.code === 'End') { event.preventDefault(); setIndex(total - 1); }
  }
  async function enterFullscreen() {
    try {
      if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else setNotice('Trình duyệt này chỉ hỗ trợ trình chiếu trong cửa sổ.');
    } catch { setNotice('Chưa bật được toàn màn hình. Bạn vẫn có thể xem trong cửa sổ.'); }
  }
  return <dialog ref={dialog} id="presentation" data-theme={theme} aria-label="Trình chiếu lời bài hát" onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={handleKey}>
    <div className="slide-top"><span className="slide-title">{track.trackName}</span><div className="slide-brand" aria-hidden="true"><span className="marquee-track"><span>ÂM THANH NHẠC SỐNG HỒNG LÂM</span><span aria-hidden="true">ÂM THANH NHẠC SỐNG HỒNG LÂM</span></span></div><div className="slide-corner"><output className="slide-counter" aria-label="Trang trình chiếu">{index + 1}/{total}</output><button className="slide-exit" onClick={onClose}>Thoát (Esc)</button></div></div>
    <div ref={stage} className="slide-stage" tabIndex={0} role="region" aria-label="Lời trình chiếu" onClick={() => move(1)}><pre ref={lyrics} id="present-lyrics" aria-live="polite">{text}</pre></div>
    <div className="slide-bottom">
      <div className="slide-options"><label>Cỡ chữ <input type="range" min="28" max="150" value={size} onChange={event => setSize(Number(event.target.value))} /></label>{!fullscreen && <button onClick={enterFullscreen}>Toàn màn hình</button>}</div>
      <nav className="slide-navigation" aria-label="Chuyển đoạn lời"><div className="slide-arrows"><button aria-label="Đoạn trước" disabled={index === 0} onClick={() => move(-1)}>←</button><span>← → / Space</span><button aria-label="Đoạn tiếp" disabled={index === total - 1} onClick={() => move(1)}>→</button></div><div className="slide-dots">{Array.from({length: total}, (_, page) => <button key={page} aria-label={page === 0 ? 'Thông tin bài hát' : `Đoạn ${page}`} aria-current={page === index ? 'step' : undefined} onClick={() => setIndex(page)} />)}</div></nav>
      <div className="slide-theme" role="group" aria-label="Giao diện trình chiếu"><label><input type="radio" name="presentation-theme" value="light" checked={theme === 'light'} onChange={() => changeTheme('light')} /> Nền sáng</label><label><input type="radio" name="presentation-theme" value="dark" checked={theme === 'dark'} onChange={() => changeTheme('dark')} /> Nền tối</label></div>
    </div>
    {notice && <p className="slide-notice" role="status">{notice}</p>}
  </dialog>;
}
