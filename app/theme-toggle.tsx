'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from './theme-provider';
import s from './theme-toggle.module.css';

type Theme = 'system' | 'light' | 'dark';
const THEME_LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };
const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon };

export default function ThemeToggle({ className = '', iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const selected = mounted && (theme === 'light' || theme === 'dark') ? theme : 'system';
  const Icon = THEME_ICONS[selected];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className={`${s.toggle} ${iconOnly ? s.iconOnly : ''} ${className}`.trim()}
          aria-label={`Appearance: ${THEME_LABELS[selected]}`}
          title={iconOnly ? undefined : `Appearance: ${THEME_LABELS[selected]}`}
        >
          <Icon aria-hidden="true" />
          {!iconOnly && (
            <>
              <span className={s.label}>Theme</span>
              <span className={s.current}>{THEME_LABELS[selected]}</span>
              <ChevronDown aria-hidden="true" className={s.chevron} />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className={s.menu}>
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selected} onValueChange={(value) => setTheme(value as Theme)}>
          <DropdownMenuRadioItem value="system"><Monitor aria-hidden="true" />System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light"><Sun aria-hidden="true" />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon aria-hidden="true" />Dark</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
