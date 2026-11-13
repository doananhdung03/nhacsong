'use client';

import { useEffect, useRef, useState } from 'react';
import { plainText } from '../lib/lyrics.mjs';
import useAutoScroll from './use-auto-scroll';

export default function Presentation({ track, onClose }) {
  const dialog = useRef(null), viewport = useRef(null);
  const [size, setSize] = useState(52), [speed, setSpeed] = useState(30);
  const [fullscreen, setFullscreen] = useState(false), [fullscreenError, setFullscreenError] = useState('');
  const scroll = useAutoScroll(viewport, speed);
  useEffect(() => {
    const node = dialog.current;
    node.showModal(); viewport.current.focus();
    function onFullscreenChange() { setFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      if (document.fullscreenElement === node) document.exitFullscreen().catch(() => {});
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (dialog.current.requestFullscreen) await dialog.current.requestFullscreen();
      else setFullscreenError('Trình duyệt chưa hỗ trợ toàn màn hình.');
    } catch { setFullscreenError('Trình duyệt chưa cho phép toàn màn hình.'); }
  }
  function handleKey(event) {
    if (event.code === 'Space' && !['INPUT', 'BUTTON'].includes(event.target.tagName)) { event.preventDefault(); scroll.toggle(); }
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.code) && event.target.tagName !== 'INPUT') {
      event.preventDefault(); scroll.stop();
      viewport.current.scrollBy({ top: (event.code.endsWith('Up') ? -1 : 1) * (event.code.startsWith('Page') ? 400 : 90) });
    }
  }
  return <dialog ref={dialog} id="presentation" aria-label="Trình chiếu lời bài hát" onClose={onClose} onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={handleKey}>
    <div className="present-top"><div><strong>{track.trackName}</strong><span>{track.artistName}</span></div><button className="outline" onClick={onClose}>Đóng · Esc</button></div>
    <div className="present-tools"><button className="outline" aria-pressed={scroll.running} onClick={scroll.toggle}>{scroll.running ? 'Ⅱ Dừng cuộn' : '▷ Tự cuộn'}</button><label>Cỡ chữ <input type="range" min="28" max="100" value={size} onChange={event => setSize(Number(event.target.value))} /></label><label>Tốc độ <input type="range" min="10" max="100" value={speed} onChange={event => setSpeed(Number(event.target.value))} /></label><button className="outline" onClick={toggleFullscreen}>{fullscreen ? '⛶ Thu nhỏ' : '⛶ Toàn màn hình'}</button>{fullscreenError && <span role="status">{fullscreenError}</span>}</div>
    <div ref={viewport} id="present-viewport" tabIndex={0} aria-label="Lời trình chiếu" onWheel={scroll.stop} onTouchStart={scroll.stop}><pre id="present-lyrics" style={{ fontSize: size }}>{plainText(track) || 'Chưa có lời cho bản thu này.'}</pre></div>
    <div className="present-hint">Dùng ↑ ↓ hoặc cuộn để theo nhịp ban nhạc · Space: bật / dừng tự cuộn</div>
  </dialog>;
}
