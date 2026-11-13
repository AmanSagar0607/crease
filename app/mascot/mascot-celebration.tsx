'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import LivingCat from './living-cat';
import {
  mascotEventCopy,
  subscribeMascotEvents,
  type MascotEventDetail,
} from './mascot-events';
import s from './mascot-celebration.module.css';

const TOAST_MS = 5600;
const GAP_MS = 280;

export default function MascotCelebration() {
  const [current, setCurrent] = useState<MascotEventDetail | null>(null);
  const currentRef = useRef<MascotEventDetail | null>(null);
  const queue = useRef<MascotEventDetail[]>([]);
  const timer = useRef<number | null>(null);
  const gapTimer = useRef<number | null>(null);
  const transitioning = useRef(false);

  const show = useCallback((detail: MascotEventDetail) => {
    currentRef.current = detail;
    setCurrent(detail);
  }, []);

  const dismiss = useCallback(() => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    currentRef.current = null;
    transitioning.current = true;
    setCurrent(null);

    gapTimer.current = window.setTimeout(() => {
      const next = queue.current.shift();
      transitioning.current = false;
      if (next) show(next);
    }, GAP_MS);
  }, [show]);

  useEffect(() => {
    return subscribeMascotEvents((detail) => {
      if (currentRef.current || transitioning.current) {
        queue.current.push(detail);
        return;
      }
      show(detail);
    });
  }, [show]);

  useEffect(() => {
    if (!current) return;

    timer.current = window.setTimeout(dismiss, TOAST_MS);
    return () => {
      if (timer.current) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [current, dismiss]);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      if (gapTimer.current) window.clearTimeout(gapTimer.current);
    };
  }, []);

  if (!current) return null;

  const copy = mascotEventCopy(current);

  return (
    <aside className={s.toast} role="status" aria-live="polite" aria-atomic="true">
      <div className={s.cat} aria-hidden="true">
        <LivingCat variant="toast" interactive={false} celebration={current} />
      </div>
      <div className={s.copy}>
        <strong>{copy.title}</strong>
        <span>{copy.body}</span>
      </div>
      <button className={s.dismiss} type="button" onClick={dismiss} aria-label="Dismiss mascot message">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </aside>
  );
}
