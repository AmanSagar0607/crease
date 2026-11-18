'use client';

import { useEffect, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { invalidCustomRange, type AttributionModel, type Preset, type Range } from './reporting';
import s from './sections.module.css';

type Props = {
  preset: Preset;
  range: Range;
  draft: Range;
  model: AttributionModel;
  conversionEvent: string;
  onPresetChange: (preset: Preset) => void;
  onDraftChange: (draft: Range) => void;
  onApplyRange: () => void;
  onModelChange: (model: AttributionModel) => void;
  onConversionEventChange: (value: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  updatedLabel?: string;
};

const RANGE_BUTTONS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: '7', label: '7d' },
  { key: '30', label: '30d' },
  { key: 'custom', label: 'Custom' },
];
const MORE_RANGES: { key: Preset; label: string }[] = [
  { key: 'yesterday', label: 'Yesterday' },
  { key: '90', label: '90 days' },
];
const ATTRIBUTION_OPTIONS: { key: AttributionModel; label: string }[] = [
  { key: 'first_touch', label: 'First touch' },
  { key: 'last_touch', label: 'Last touch' },
  { key: 'last_non_direct', label: 'Last non-direct' },
];

export default function ReportToolbar({
  preset,
  range,
  draft,
  model,
  conversionEvent,
  onPresetChange,
  onDraftChange,
  onApplyRange,
  onModelChange,
  onConversionEventChange,
  onRefresh,
  refreshing = false,
  updatedLabel,
}: Props) {
  const [conversionDraft, setConversionDraft] = useState(conversionEvent);
  const filtersRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => setConversionDraft(conversionEvent), [conversionEvent]);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (filtersRef.current?.open && !filtersRef.current.contains(event.target as Node)) {
        filtersRef.current.open = false;
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  const invalid = invalidCustomRange(draft);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className={s.toolbar} aria-label="Report controls">
      <div className={s.toolbarRow}>
        <div className={s.rangeGroup} role="group" aria-label="Reporting period">
          {RANGE_BUTTONS.map(({ key, label }) => (
            <button
              className={s.rangeButton}
              key={key}
              type="button"
              aria-pressed={preset === key}
              onClick={() => onPresetChange(key)}
            >
              {key === 'custom' && <CalendarDays aria-hidden="true" />}
              {label}
            </button>
          ))}
          <details className={s.moreRanges}>
            <summary aria-label="More reporting periods"><span>More</span><ChevronDown aria-hidden="true" /></summary>
            <div className={s.moreRangesMenu}>
              {MORE_RANGES.map(({ key, label }) => (
                <button key={key} type="button" aria-pressed={preset === key} onClick={() => onPresetChange(key)}>{label}</button>
              ))}
            </div>
          </details>
        </div>

        <details
          className={s.filtersPopover}
          ref={filtersRef}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && filtersRef.current) {
              filtersRef.current.open = false;
              filtersRef.current.querySelector('summary')?.focus();
            }
          }}
        >
          <summary><SlidersHorizontal aria-hidden="true" /> Filters <ChevronDown aria-hidden="true" /></summary>
          <div className={s.filterPanel}>
            <fieldset className={s.attributionGroup}>
              <legend>Attribution model</legend>
              <div role="radiogroup" aria-label="Attribution model">
                {ATTRIBUTION_OPTIONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={model === key}
                    onClick={() => onModelChange(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <form
              className={s.conversionForm}
              onSubmit={(event) => {
                event.preventDefault();
                onConversionEventChange(conversionDraft.trim());
              }}
            >
              <label htmlFor="conversion-event">Conversion event</label>
              <div className={s.conversionActions}>
                <input
                  id="conversion-event"
                  type="text"
                  maxLength={64}
                  value={conversionDraft}
                  onChange={(event) => setConversionDraft(event.target.value)}
                  placeholder="e.g. signup"
                />
                <button type="submit">Apply</button>
                {conversionEvent && (
                  <button type="button" onClick={() => { setConversionDraft(''); onConversionEventChange(''); }}>Clear</button>
                )}
              </div>
            </form>
            <p className={s.timezone}>Timezone: UTC calendar days</p>
          </div>
        </details>

        {onRefresh && (
          <button className={s.refreshIconButton} type="button" onClick={onRefresh} disabled={refreshing} aria-label="Refresh analytics" title="Refresh analytics">
            <RefreshCw aria-hidden="true" className={refreshing ? s.spinning : undefined} />
          </button>
        )}
        {updatedLabel && <span className={s.updatedStatus}>{updatedLabel}</span>}
        <span className={s.rangeStatus} aria-live="polite">{range.start} – {range.end} UTC</span>
      </div>

      {preset === 'custom' && (
        <div className={s.customRange}>
          <label><span>From</span><input type="date" value={draft.start} max={draft.end || today} onChange={(event) => onDraftChange({ ...draft, start: event.target.value })} /></label>
          <label><span>To</span><input type="date" value={draft.end} max={today} onChange={(event) => onDraftChange({ ...draft, end: event.target.value })} /></label>
          <button type="button" disabled={invalid} onClick={onApplyRange}>Apply dates</button>
          {invalid && <span className={s.rangeError}>Choose up to 90 UTC calendar days ending no later than today.</span>}
        </div>
      )}
    </section>
  );
}
