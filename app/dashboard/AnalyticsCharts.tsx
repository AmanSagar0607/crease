'use client';

import { useState } from 'react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, PolarAngleAxis,
  PolarGrid, PolarRadiusAxis, Radar, RadarChart, RadialBar, RadialBarChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Pie, PieChart,
} from 'recharts';
import s from './dashboard.module.css';

type Point = { date: string; events: number; pageviews: number; visitors: number; sessions: number };
type Metrics = { events: number; pageviews: number; visitors: number; sessions: number };
type ChartKind = 'area' | 'bar' | 'line' | 'pie' | 'radar' | 'radial';
const CHARTS: { id: ChartKind; label: string }[] = [
  { id: 'area', label: 'Area' }, { id: 'bar', label: 'Bar' }, { id: 'line', label: 'Line' },
  { id: 'pie', label: 'Pie' }, { id: 'radar', label: 'Radar' }, { id: 'radial', label: 'Radial' },
];
const SERIES = [
  { key: 'visitors', label: 'Visitors', color: 'var(--ink)' },
  { key: 'pageviews', label: 'Page views', color: 'var(--chartAlt)' },
  { key: 'sessions', label: 'Sessions', color: 'var(--chartThird)' },
  { key: 'events', label: 'Events', color: 'var(--chartFourth)' },
] as const;
const PIE_COLORS = ['var(--ink)', 'var(--chartAlt)', 'var(--chartThird)', 'var(--chartFourth)'];

function Tip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className={s.chartTooltip}><strong>{label}</strong>{payload.map((entry) => <span key={entry.name}><i style={{ background: entry.color }} />{entry.name}<b>{entry.value.toLocaleString()}</b></span>)}</div>;
}

export default function AnalyticsCharts({ series, metrics }: { series: Point[]; metrics: Metrics }) {
  const [kind, setKind] = useState<ChartKind>('area');
  const totals = SERIES.map((item) => ({ name: item.label, value: metrics[item.key], fill: item.color }));
  return (
    <section className={s.chartCard} aria-label="Analytics charts">
      <div className={s.chartHeading}>
        <div><h3>{kind === 'pie' || kind === 'radar' || kind === 'radial' ? 'Metric comparison' : 'Traffic over time'}</h3><p>{kind === 'pie' || kind === 'radar' || kind === 'radial' ? 'Selected reporting period' : 'Daily totals'}</p></div>
        <div className={s.chartSwitch} role="group" aria-label="Choose chart type">
          {CHARTS.map((chart) => <button key={chart.id} type="button" aria-pressed={kind === chart.id} onClick={() => setKind(chart.id)}>{chart.label}</button>)}
        </div>
      </div>
      <div className={s.rechartWrap}>
        {kind === 'pie' ? <ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip content={<Tip />} /><Pie data={totals} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="78%" paddingAngle={3}>{totals.map((item, i) => <Cell key={item.name} fill={PIE_COLORS[i]} />)}</Pie></PieChart></ResponsiveContainer>
          : kind === 'radar' ? <ResponsiveContainer width="100%" height="100%"><RadarChart data={totals}><PolarGrid stroke="var(--line)" /><PolarAngleAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><PolarRadiusAxis tick={false} axisLine={false} /><Radar dataKey="value" name="Total" stroke="var(--ink)" fill="var(--ink)" fillOpacity={0.18} /><Tooltip content={<Tip />} /></RadarChart></ResponsiveContainer>
          : kind === 'radial' ? <ResponsiveContainer width="100%" height="100%"><RadialBarChart data={totals} innerRadius="18%" outerRadius="88%" startAngle={90} endAngle={-270}><RadialBar dataKey="value" background cornerRadius={6}>{totals.map((item, i) => <Cell key={item.name} fill={PIE_COLORS[i]} />)}</RadialBar><Tooltip content={<Tip />} /></RadialBarChart></ResponsiveContainer>
          : <ResponsiveContainer width="100%" height="100%">{kind === 'bar' ? <BarChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tickLine={false} axisLine={false} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip content={<Tip />} /><Bar dataKey="visitors" name="Visitors" fill="var(--ink)" radius={[4,4,0,0]} /><Bar dataKey="pageviews" name="Page views" fill="var(--chartAlt)" radius={[4,4,0,0]} /></BarChart> : kind === 'line' ? <LineChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tickLine={false} axisLine={false} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip content={<Tip />} /><Line dataKey="visitors" name="Visitors" stroke="var(--ink)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} /><Line dataKey="pageviews" name="Page views" stroke="var(--chartAlt)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} /></LineChart> : <AreaChart data={series} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}><defs><linearGradient id="visitorsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--ink)" stopOpacity={0.2} /><stop offset="100%" stopColor="var(--ink)" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickFormatter={(value) => new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tickLine={false} axisLine={false} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false} /><Tooltip content={<Tip />} /><Area dataKey="pageviews" name="Page views" stroke="var(--chartAlt)" fill="transparent" strokeWidth={1.5} /><Area dataKey="visitors" name="Visitors" stroke="var(--ink)" fill="url(#visitorsFill)" strokeWidth={2} /></AreaChart>}</ResponsiveContainer>}
      </div>
      <div className={s.chartLegend}>{totals.map((item, index) => <span key={item.name}><i style={{ background: PIE_COLORS[index] }} />{item.name}<b>{item.value.toLocaleString()}</b></span>)}</div>
    </section>
  );
}
