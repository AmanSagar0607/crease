'use client';

import { useEffect } from 'react';

const tabs = ['analytics', 'installation', 'integrations', 'settings'] as const;
type Tab = typeof tabs[number];

export default function ProjectTabController() {
  useEffect(() => {
    function selectedTab(): Tab {
      const candidate = window.location.hash.slice(1) as Tab;
      return tabs.includes(candidate) ? candidate : 'analytics';
    }
    function setHidden(element: Element | null, hidden: boolean) {
      if (element instanceof HTMLElement && element.hidden !== hidden) element.hidden = hidden;
    }
    function apply() {
      const active = selectedTab();
      const analytics = active === 'analytics';
      setHidden(document.getElementById('analytics'), !analytics);
      document.querySelectorAll('.metric-grid, .dashboard-grid').forEach(element => setHidden(element, !analytics));
      setHidden(document.getElementById('installation'), active !== 'installation');
      setHidden(document.getElementById('integrations'), active !== 'integrations');
      setHidden(document.getElementById('settings'), active !== 'settings');
      document.querySelectorAll<HTMLAnchorElement>('.project-nav a').forEach(link => {
        const current = link.getAttribute('href') === `#${active}`;
        if (current) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      });
    }
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', apply);
    apply();
    return () => { observer.disconnect(); window.removeEventListener('hashchange', apply); };
  }, []);
  return null;
}
