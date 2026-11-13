'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import s from './living-cat.module.css';
import {
  subscribeMascotEvents,
  type MascotEventDetail,
} from './mascot-events';

type Mood = 'sleeping' | 'waking' | 'idle' | 'happy' | 'celebrating';

type LivingCatProps = {
  variant?: 'hero' | 'dashboard' | 'toast';
  interactive?: boolean;
  listen?: boolean;
  celebration?: MascotEventDetail | null;
  className?: string;
};

const CELEBRATION_MS = 2600;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function CatArt() {
  return (
    <svg
      className={s.art}
      viewBox="0 0 160 180"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse className={s.shadow} cx="80" cy="170" rx="45" ry="6.5" />

      <g className={s.posture}>
        <g className={s.tailWrap}>
          <path
            className={s.tail}
            d="M108 148 C128 154 143 144 141 127 C140 116 132 111 126 116"
            fill="none"
            stroke="var(--catInk)"
            strokeWidth="9"
            strokeLinecap="round"
          />
        </g>

        <g className={s.body}>
          <path
            className={s.bodyShape}
            d="M52 154 C43 138 44 113 55 98 C64 86 96 86 105 98 C116 113 117 138 108 154 C99 165 61 165 52 154 Z"
            fill="var(--catBody)"
            stroke="var(--catInk)"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <path
            className={s.chest}
            d="M68 116 C72 106 88 106 92 116 C96 132 92 150 80 155 C68 150 64 132 68 116 Z"
            fill="var(--catSoft)"
          />

          <rect
            x="57"
            y="139"
            width="18"
            height="25"
            rx="9"
            fill="var(--catBody)"
            stroke="var(--catInk)"
            strokeWidth="2"
          />
          <rect
            x="85"
            y="139"
            width="18"
            height="25"
            rx="9"
            fill="var(--catBody)"
            stroke="var(--catInk)"
            strokeWidth="2"
          />
          <path
            d="M66 150 v9 M94 150 v9"
            fill="none"
            stroke="var(--catInk)"
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.4"
          />

          <g className={s.headPosture}>
            <g className={s.earLeft}>
              <path
                d="M43 48 L37 15 C36 10 41 7 45 11 L70 28 Z"
                fill="var(--catBody)"
                stroke="var(--catInk)"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <path d="M46 40 L42 20 L62 30 Z" fill="var(--catSoft)" />
            </g>
            <g className={s.earRight}>
              <path
                d="M117 48 L123 15 C124 10 119 7 115 11 L90 28 Z"
                fill="var(--catBody)"
                stroke="var(--catInk)"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              <path d="M114 40 L118 20 L98 30 Z" fill="var(--catSoft)" />
            </g>

            <g className={s.head}>
              <path
                d="M38 64 C38 38 56 28 80 28 C104 28 122 38 122 64 C122 88 104 102 80 102 C56 102 38 88 38 64 Z"
                fill="var(--catBody)"
                stroke="var(--catInk)"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />

              <g className={s.stripes} stroke="var(--catInk)" strokeWidth="2" strokeLinecap="round">
                <path d="M72 33 L70 43" />
                <path d="M80 31 L80 42" />
                <path d="M88 33 L90 43" />
              </g>

              <g className={s.eye}>
                <ellipse cx="64" cy="64" rx="8" ry="10.5" fill="var(--catInk)" />
                <circle cx="61" cy="60" r="2.5" fill="var(--catBody)" />
                <circle cx="67" cy="68" r="1.2" fill="var(--catBody)" opacity="0.7" />
              </g>
              <g className={s.eye}>
                <ellipse cx="96" cy="64" rx="8" ry="10.5" fill="var(--catInk)" />
                <circle cx="93" cy="60" r="2.5" fill="var(--catBody)" />
                <circle cx="99" cy="68" r="1.2" fill="var(--catBody)" opacity="0.7" />
              </g>

              <g className={s.closedEyes}>
                <path
                  d="M55 65 Q64 71 73 65"
                  fill="none"
                  stroke="var(--catInk)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <path
                  d="M87 65 Q96 71 105 65"
                  fill="none"
                  stroke="var(--catInk)"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </g>

              <g className={s.cheeks} aria-hidden="true">
                <ellipse cx="53" cy="78" rx="8" ry="3.8" fill="var(--catBlush)" />
                <ellipse cx="107" cy="78" rx="8" ry="3.8" fill="var(--catBlush)" />
              </g>

              <path
                className={s.nose}
                d="M76 80 C78 78 82 78 84 80 C83 84 81 85.5 80 85.5 C79 85.5 77 84 76 80 Z"
                fill="var(--catInk)"
              />
              <path
                className={s.mouth}
                d="M80 85.5 C80 90 76 91 73 90.5 M80 85.5 C80 90 84 91 87 90.5"
                fill="none"
                stroke="var(--catInk)"
                strokeWidth="1.7"
                strokeLinecap="round"
              />

              <g
                className={s.whiskers}
                fill="none"
                stroke="var(--catInk)"
                strokeWidth="1.4"
                strokeLinecap="round"
              >
                <path d="M69 84 L48 80" />
                <path d="M69 87.5 L47 88" />
                <path d="M69 91 L50 96" />
                <path d="M91 84 L112 80" />
                <path d="M91 87.5 L113 88" />
                <path d="M91 91 L110 96" />
              </g>
            </g>
          </g>
        </g>
      </g>

      <g className={s.zs}>
        <path
          className={s.z1}
          d="M119 17 h9 l-9 9 h9"
          fill="none"
          stroke="var(--catMark)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className={s.z2}
          d="M132 4 h6 l-6 6 h6"
          fill="none"
          stroke="var(--catMark)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <g className={s.sparkles} stroke="var(--catMark)" strokeWidth="1.6" strokeLinecap="round">
        <path className={s.sparkle1} d="M24 38 v10 M19 43 h10" />
        <path className={s.sparkle2} d="M137 48 v9 M132.5 52.5 h9" />
        <path className={s.sparkle3} d="M18 106 v8 M14 110 h8" />
        <path className={s.sparkle4} d="M143 112 v8 M139 116 h8" />
      </g>

      <g className={s.boopMark} stroke="var(--catMark)" strokeWidth="2" strokeLinecap="round">
        <path d="M80 5 v12 M74 8 l12 6 M86 8 l-12 6" />
      </g>
    </svg>
  );
}

export default function LivingCat({
  variant = 'hero',
  interactive = true,
  listen = false,
  celebration = null,
  className = '',
}: LivingCatProps) {
  const [mood, setMood] = useState<Mood>('sleeping');
  const [blinking, setBlinking] = useState(false);
  const [twitch, setTwitch] = useState(false);
  const [boop, setBoop] = useState(false);
  const moodRef = useRef<Mood>('sleeping');
  const hovered = useRef(false);
  const timers = useRef<number[]>([]);
  const blinkTimer = useRef<number | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    if (blinkTimer.current) {
      window.clearTimeout(blinkTimer.current);
      blinkTimer.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const blink = useCallback(() => {
    if (blinkTimer.current) window.clearTimeout(blinkTimer.current);
    setBlinking(true);
    blinkTimer.current = window.setTimeout(() => setBlinking(false), 150);
  }, []);

  const wake = useCallback(() => {
    if (moodRef.current === 'celebrating') return;
    clearTimers();
    setMood('waking');
    timers.current.push(
      window.setTimeout(() => {
        if (moodRef.current === 'waking') setMood('idle');
      }, reduced ? 0 : 420),
    );
  }, [clearTimers, reduced]);

  const rest = useCallback(() => {
    if (moodRef.current === 'celebrating' || moodRef.current === 'happy') return;
    clearTimers();
    setMood('sleeping');
  }, [clearTimers]);

  const celebrate = useCallback(() => {
    clearTimers();
    setMood('celebrating');
    setBlinking(false);
    setBoop(false);

    timers.current.push(
      window.setTimeout(() => {
        setMood('happy');
        timers.current.push(
          window.setTimeout(() => {
            setMood(variant === 'toast' || hovered.current ? 'idle' : 'sleeping');
          }, 700),
        );
      }, CELEBRATION_MS),
    );
  }, [clearTimers, variant]);

  useEffect(() => {
    if (!celebration) return;
    celebrate();
  }, [celebration, celebrate]);

  useEffect(() => {
    if (!listen) return;
    return subscribeMascotEvents(() => celebrate());
  }, [listen, celebrate]);

  useEffect(() => {
    if (reduced || mood === 'sleeping' || mood === 'waking' || mood === 'celebrating') return;

    let alive = true;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (!alive) return;
        blink();
        if (Math.random() < 0.18) {
          timer = window.setTimeout(() => {
            if (alive) blink();
          }, 230);
        }
        schedule();
      }, 2800 + Math.random() * 3800);
    };

    schedule();
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [mood, reduced, blink]);

  useEffect(() => {
    if (reduced || mood !== 'idle') return;

    let alive = true;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        if (!alive) return;
        setTwitch(true);
        timer = window.setTimeout(() => {
          if (!alive) return;
          setTwitch(false);
          schedule();
        }, 320);
      }, 4200 + Math.random() * 5200);
    };

    schedule();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      setTwitch(false);
    };
  }, [mood, reduced]);

  const handleEnter = () => {
    hovered.current = true;
    wake();
  };

  const handleLeave = () => {
    hovered.current = false;
    rest();
  };

  const handleClick = () => {
    if (moodRef.current === 'celebrating') return;
    clearTimers();
    setMood('happy');
    setBoop(true);
    blink();
    timers.current.push(window.setTimeout(() => setBoop(false), 650));
    timers.current.push(
      window.setTimeout(() => {
        setMood(hovered.current ? 'idle' : 'sleeping');
      }, 760),
    );
  };

  const stateProps = {
    'data-mood': mood,
    'data-blinking': blinking ? 'true' : 'false',
    'data-twitch': twitch ? 'true' : 'false',
    'data-boop': boop ? 'true' : 'false',
  };

  if (!interactive) {
    return (
      <div
        className={`${s.cat} ${s[variant]} ${className}`.trim()}
        aria-hidden="true"
        {...stateProps}
      >
        <CatArt />
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`${s.cat} ${s[variant]} ${className}`.trim()}
      aria-label="Wake the Crease cat"
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      onClick={handleClick}
      {...stateProps}
    >
      <CatArt />
    </button>
  );
}
