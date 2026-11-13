'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export default function useAutoScroll(viewport, speed) {
  const [running, setRunning] = useState(false);
  const speedRef = useRef(speed);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  const stop = useCallback(() => setRunning(false), []);
  useEffect(() => {
    const target = viewport.current;
    if (!running || !target) return;
    let frame, previous, position = target.scrollTop;
    function tick(now) {
      if (previous !== undefined) {
        position += Math.min(now - previous, 100) / 1000 * speedRef.current;
        target.scrollTop = position;
      }
      previous = now;
      if (target.scrollTop + target.clientHeight >= target.scrollHeight - 1) stop();
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    function onHidden() { if (document.hidden) stop(); }
    document.addEventListener('visibilitychange', onHidden);
    return () => { cancelAnimationFrame(frame); document.removeEventListener('visibilitychange', onHidden); };
  }, [running, viewport, stop]);
  return { running, stop, toggle: () => setRunning(value => !value) };
}
