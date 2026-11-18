'use client';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

const videoSource = '/video/gemini_generated_video_8991f96f.mp4';

export default function PromoVideo() {
  const dialog = useRef(null), trigger = useRef(null), enteredFullscreen = useRef(false);
  const video = useRef(null);
  const [open, setOpen] = useState(false), [notice, setNotice] = useState('');

  function close() {
    video.current?.pause();
    dialog.current?.close();
    setOpen(false);
    if (document.fullscreenElement === dialog.current) document.exitFullscreen().catch(() => {});
    enteredFullscreen.current = false;
    trigger.current?.focus();
  }
  useEffect(() => {
    function fullscreenChanged() {
      if (document.fullscreenElement === dialog.current) enteredFullscreen.current = true;
      else if (enteredFullscreen.current && dialog.current?.open) close();
    }
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => document.removeEventListener('fullscreenchange', fullscreenChanged);
  }, []);

  function play() {
    setNotice('');
    flushSync(() => setOpen(true));
    dialog.current.showModal();
    video.current.play().catch(() => { if (dialog.current?.open) setNotice('Bấm nút phát trong video để bắt đầu.'); });
    // Request synchronously from the click so browsers keep user activation.
    if (dialog.current.requestFullscreen) {
      dialog.current.requestFullscreen().catch(() => setNotice('Trình duyệt chưa cho phép toàn màn hình. Video vẫn mở trong khung lớn.'));
    } else if (video.current.webkitEnterFullscreen) {
      video.current.webkitEnterFullscreen();
    }
  }

  return <>
    <div className="promo-actions"><button ref={trigger} type="button" className="promo-trigger" title="Phát video quảng cáo" aria-label="Phát video quảng cáo" onClick={play}><svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22"><rect x="2" y="4" width="20" height="16" rx="4" fill="none" stroke="currentColor" strokeWidth="1.8"/><path d="m10 8 6 4-6 4z" fill="currentColor"/></svg></button></div>
    <dialog ref={dialog} className="promo-dialog" aria-label="Video quảng cáo Hồng Lâm" onCancel={event => { event.preventDefault(); close(); }}>
      <div className="promo-toolbar"><strong>Video quảng cáo Hồng Lâm</strong><button type="button" className="outline" onClick={close}>Đóng video quảng cáo</button></div>
      {open && <video ref={video} src={videoSource} controls playsInline preload="metadata" aria-label="Video quảng cáo Hồng Lâm" onError={() => setNotice('Không tải được video. Vui lòng kiểm tra kết nối và thử lại.')} onEnded={close} />}
      {notice && <p className="promo-note" role="status">{notice}</p>}
    </dialog>
  </>;
}
