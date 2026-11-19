'use client';

import { useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import s from './waitlist.module.css';

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(targetMs: number): TimeLeft {
  const remaining = Math.max(0, targetMs - Date.now());
  return {
    days: Math.floor(remaining / 86_400_000),
    hours: Math.floor(remaining / 3_600_000) % 24,
    minutes: Math.floor(remaining / 60_000) % 60,
    seconds: Math.floor(remaining / 1_000) % 60,
  };
}

export default function Countdown({ target }: { target?: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const launchAt = target ? new Date(target).getTime() : Number.NaN;
  const isConfigured = Number.isFinite(launchAt) && launchAt > Date.now();

  useEffect(() => {
    if (!isConfigured) return;
    const update = () => setTimeLeft(getTimeLeft(launchAt));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [isConfigured, launchAt]);

  if (!isConfigured) {
    return (
      <div className={s.countdownNotice}>
        <CalendarDays aria-hidden="true" />
        <span>Launch date to be announced</span>
      </div>
    );
  }

  const units = [
    ['Days', timeLeft?.days],
    ['Hours', timeLeft?.hours],
    ['Minutes', timeLeft?.minutes],
    ['Seconds', timeLeft?.seconds],
  ] as const;

  return (
    <div className={s.countdown}>
      <p className={s.countdownLabel}><CalendarDays aria-hidden="true" /> Time until launch</p>
      <div className={s.timer} role="timer" aria-label="Time remaining until launch">
        {units.map(([label, value]) => (
          <div className={s.unit} key={label}>
            <span className={s.num}>{value === undefined ? '—' : String(value).padStart(2, '0')}</span>
            <span className={s.unitLabel}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
