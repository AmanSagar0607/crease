import Image from 'next/image';
import s from './landing.module.css';

type ZappaWordmarkProps = {
  variant?: 'navigation' | 'footer';
};

export default function ZappaWordmark({ variant = 'navigation' }: ZappaWordmarkProps) {
  const dimensions = variant === 'footer'
    ? { width: 112, height: 29 }
    : { width: 94, height: 24 };

  return (
    <span className={`${s.wordmark} ${variant === 'footer' ? s.wordmarkFooter : ''}`} aria-hidden="true">
      <Image className={s.wordmarkLight} src="/brand/zappa-logo.svg" alt="" {...dimensions} />
      <Image className={s.wordmarkDark} src="/brand/zappa-logo-dark.svg" alt="" {...dimensions} />
    </span>
  );
}
