'use client';

import { useId } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { SeriesPoint } from './reporting';
import styles from './traffic-chart.module.css';

const chartConfig: ChartConfig = {
  visitors: { label: 'Visitors', color: 'var(--accent-line)' },
  sessions: { label: 'Sessions', color: 'var(--chart-muted)' },
  previous_visitors: { label: 'Previous visitors', color: 'var(--muted)' },
  previous_sessions: { label: 'Previous sessions', color: 'var(--muted)' },
};

type TrafficChartProps = {
  data: SeriesPoint[];
  sparse?: boolean;
  animate?: boolean;
  animationActive?: boolean;
  reducedMotion?: boolean;
};

/** Reusable visitors, sessions, and prior-period chart for analytics reports. */
export default function TrafficChart({
  data,
  sparse = false,
  animate = false,
  animationActive = false,
  reducedMotion = false,
}: TrafficChartProps) {
  const gradientId = `traffic-visitors-${useId().replace(/:/g, '')}`;
  const hasTraffic = data.some((point) => point.visitors || point.sessions || point.previous_visitors || point.previous_sessions);
  const shouldAnimate = animate && animationActive && !reducedMotion;

  if (!hasTraffic) {
    return <p className={styles.empty}>No traffic in this period. A chart will appear when activity arrives.</p>;
  }

  return (
    <div className={styles.chartBody}>
      <div className={styles.legend} aria-label="Chart legend">
        <span className={styles.visitors}><i aria-hidden="true" />Visitors</span>
        <span className={styles.sessions}><i aria-hidden="true" />Sessions</span>
        <span className={styles.previous}><i aria-hidden="true" />Previous period</span>
      </div>
      {sparse && <p className={styles.sparseNote}>Activity is sparse in this period; markers show observed days.</p>}
      <div className={styles.plot}>
        <ChartContainer
          config={chartConfig}
          className={styles.chartContainer}
          role="group"
          aria-label="Daily visitors and sessions compared with the previous period. Use the arrow keys to inspect each day."
        >
          <ComposedChart
            accessibilityLayer
            data={data}
            margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
            barCategoryGap="38%"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-visitors)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-visitors)" stopOpacity={0.015} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" strokeOpacity={0.72} vertical={false} />
            <XAxis
              dataKey="date"
              interval={Math.max(0, Math.ceil(data.length / 6) - 1)}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickFormatter={(date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' })}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={16}
            />
            <YAxis
              width={38}
              domain={[0, 'dataMax']}
              tickCount={5}
              allowDecimals={false}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              cursor={{ stroke: 'var(--lineStrong)', strokeDasharray: '3 4', strokeWidth: 1 }}
              content={<ChartTooltipContent labelFormatter={(label) => `${String(label)} UTC`} />}
            />
            <Area
              type="monotone"
              dataKey="visitors"
              name="Visitors"
              fill={`url(#${gradientId})`}
              stroke="none"
              activeDot={false}
              tooltipType="none"
              isAnimationActive={shouldAnimate}
              animationBegin={240}
              animationDuration={900}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="sessions"
              name="Sessions"
              fill="var(--color-sessions)"
              fillOpacity={0.8}
              radius={[4, 4, 0, 0]}
              maxBarSize={18}
              isAnimationActive={shouldAnimate}
              animationBegin={360}
              animationDuration={760}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="previous_sessions"
              name="Previous sessions"
              stroke="var(--color-previous_sessions)"
              strokeDasharray="3 5"
              strokeOpacity={0.66}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={shouldAnimate}
              animationBegin={430}
              animationDuration={760}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="previous_visitors"
              name="Previous visitors"
              stroke="var(--color-previous_visitors)"
              strokeDasharray="5 5"
              strokeOpacity={0.78}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={shouldAnimate}
              animationBegin={500}
              animationDuration={820}
              animationEasing="ease-out"
            />
            <Line
              type="monotone"
              dataKey="visitors"
              name="Visitors"
              stroke="var(--color-visitors)"
              strokeWidth={2.5}
              dot={sparse ? { r: 3.5, strokeWidth: 2, fill: 'var(--paper)' } : false}
              activeDot={{ r: 5, strokeWidth: 2, fill: 'var(--paper)' }}
              isAnimationActive={shouldAnimate}
              animationBegin={200}
              animationDuration={1050}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </div>
  );
}
