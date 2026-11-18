'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import {
  Activity,
  ArrowUpRight,
  FileText,
  Globe,
  LineChart,
  MousePointer2,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import OverviewV1 from '../dashboard/OverviewV1';
import ThemeToggle from '../theme-toggle';
import { createSampleReport } from './sample-report';
import s from './v0-preview.module.css';

export default function V0Dashboard() {
  const report = useMemo(() => createSampleReport(), []);

  return (
    <div className={s.page}>
      <TooltipProvider>
      <SidebarProvider
        className={s.layout}
        style={{ '--sidebar-width': '248px', '--sidebar-width-icon': '64px' } as CSSProperties}
      >
        <Sidebar collapsible="icon" className={s.sidebar}>
          <SidebarHeader className={s.sidebarHeader}>
            <Link className={s.wordmark} href="/" aria-label="Zappa home">Zappa</Link>
            <div className={s.projectSwitcher} aria-label="Sample project">
              <span className={s.projectIcon} aria-hidden="true">S</span>
              <span className={s.projectText}><strong>Sample project</strong><small>sample-site.example</small></span>
              <span className={s.chevron} aria-hidden="true">⌄</span>
            </div>
          </SidebarHeader>
          <SidebarContent className={s.sidebarScroll}>
            <SidebarGroup>
              <SidebarGroupLabel>Analytics</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive size="lg" tooltip="Overview">
                    <a href="#overview"><LineChart aria-hidden="true" /><span>Overview</span></a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton disabled size="lg" tooltip="Acquisition — preview only"><MousePointer2 aria-hidden="true" /><span>Acquisition</span></SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton disabled size="lg" tooltip="Pages — preview only"><FileText aria-hidden="true" /><span>Pages</span></SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton disabled size="lg" tooltip="Events — preview only"><Activity aria-hidden="true" /><span>Events</span></SidebarMenuButton></SidebarMenuItem>
                <SidebarMenuItem><SidebarMenuButton disabled size="lg" tooltip="Countries — preview only"><Globe aria-hidden="true" /><span>Countries</span></SidebarMenuButton></SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem><SidebarMenuButton disabled size="lg" tooltip="Settings — preview only"><Settings aria-hidden="true" /><span>Settings</span></SidebarMenuButton></SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className={s.sidebarFooter}>
            <span className={s.previewAvatar} aria-hidden="true">V</span>
            <span className={s.footerCopy}><strong>Preview mode</strong><small>No account connected</small></span>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className={s.inset}>
          <header className={s.topbar}>
            <div className={s.topbarLeft}>
              <SidebarTrigger className={s.sidebarTrigger} aria-label="Open or collapse navigation" />
              <span className={s.breadcrumb}>Sample project <span aria-hidden="true">/</span> Overview</span>
            </div>
            <div className={s.topbarActions}>
              <ThemeToggle />
              <Button asChild className={s.startButton}>
                <Link href="/sign-up">Start free <ArrowUpRight aria-hidden="true" /></Link>
              </Button>
            </div>
          </header>

          <main className={s.main}>
            <div className={s.content}>
              <div className={s.pageHead}>
                <div>
                  <p className={s.eyebrow}>DESIGN PREVIEW</p>
                  <h1>Overview</h1>
                  <p>Observed traffic and conversion activity for this sample project.</p>
                </div>
                <span className={s.period}>Last 7 days <span aria-hidden="true">⌄</span></span>
              </div>

              <aside className={s.sampleNotice} aria-label="Sample data notice">
                <span className={s.sampleDot} aria-hidden="true" />
                <p><strong>Sample data</strong> — illustrative values only; this is not customer or live project analytics.</p>
              </aside>

              <div className={s.previewToolbar} aria-label="Preview controls">
                <div className={s.rangeGroup} role="group" aria-label="Report date range preview">
                  <Button variant="outline" size="lg" disabled>24h</Button>
                  <Button variant="outline" size="lg" disabled aria-pressed="true">7d</Button>
                  <Button variant="outline" size="lg" disabled>30d</Button>
                  <Button variant="outline" size="lg" disabled>Custom</Button>
                </div>
                <Button variant="outline" size="lg" disabled>Filters</Button>
                <span className={s.previewOnly}>Controls wire up in the next pass</span>
              </div>

              <OverviewV1
                report={report}
                loading={false}
                error=""
                onRetry={() => undefined}
                model="last_non_direct"
                conversionEvent="signup"
                filtered={false}
                onNavigate={(section) => {
                  const target = document.getElementById(section);
                  if (target) window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' });
                }}
              />

              <div className={s.reviewNote}>
                <span>V0</span>
                <p>This review route demonstrates the landing preview and dashboard shell; remaining report controls and sections stay with the existing app until you approve this direction.</p>
              </div>
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
      </TooltipProvider>
    </div>
  );
}
