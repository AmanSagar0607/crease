'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import ThemeToggle from './theme-toggle';
import s from './landing.module.css';

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={s.navWrap}>
      <nav className={s.nav} aria-label="Main navigation">
        <Link className={s.brand} href="/" onClick={close}>Zappa</Link>
        <div className={s.navLinks}>
          <a href="#how">How it works</a>
          <Link href="/pricing">Pricing</Link>
          <Link href="/docs">Docs</Link>
          <Link href="/v0-preview">Preview</Link>
          <a href="https://github.com/AmanSagar0607/Zappa" target="_blank" rel="noreferrer">GitHub <ArrowUpRight aria-hidden="true" /></a>
        </div>
        <div className={s.navEnd}>
          <span className={s.navTheme}><ThemeToggle /></span>
          <Link className={s.navQuiet} href="/sign-in">Log in</Link>
          <Link className={s.navAction} href="/sign-up">Start free</Link>
          <button
            ref={toggleRef}
            className={s.mobileMenuToggle}
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="zappa-mobile-menu"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </nav>
      {open && (
        <div className={s.mobileMenuLayer}>
          <button className={s.mobileMenuBackdrop} type="button" aria-label="Close menu" onClick={close} />
          <div className={s.mobileMenuPanel} id="zappa-mobile-menu" role="dialog" aria-modal="true" aria-label="Site navigation" ref={panelRef}>
            <div className={s.mobileMenuHead}>
              <span className={s.mobileMenuBrand}>Zappa</span>
              <button className={s.mobileMenuClose} type="button" aria-label="Close menu" onClick={close}><X aria-hidden="true" /></button>
            </div>
            <Link href="#how" onClick={close}>How it works</Link>
            <Link href="/pricing" onClick={close}>Pricing</Link>
            <Link href="/docs" onClick={close}>Documentation</Link>
            <Link href="/v0-preview" onClick={close}>Dashboard preview</Link>
            <Link href="/waitlist" onClick={close}>Early access</Link>
            <a href="https://github.com/AmanSagar0607/Zappa" target="_blank" rel="noreferrer" onClick={close}>GitHub <ArrowUpRight aria-hidden="true" /></a>
            <div className={s.mobileMenuTheme}><ThemeToggle /></div>
            <div className={s.mobileMenuActions}>
              <Link className={s.mobileMenuLogin} href="/sign-in" onClick={close}>Log in</Link>
              <Link className={s.mobileMenuStart} href="/sign-up" onClick={close}>Start free <ArrowUpRight aria-hidden="true" /></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
