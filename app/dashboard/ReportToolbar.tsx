'use client';

import { useEffect, useState } from 'react';
import { invalidCustomRange, PRESET_LABELS, type AttributionModel, type Preset, type Range } from './reporting';
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

/**
 * Shared reporting controls: date presets, custom UTC range, attribution model
 * and the selected conversion event. Rendered once above analytics sections so
 * every section reads the same reporting window.
 */
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
  useEffect(() => setConversionDraft(conversionEvent), [conversionEvent]);
  const invalid = invalidCustomRange(draft);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={s.toolbar} role="group" aria-label="Reporting controls">
      <div className={s.toolbarRow}>
        <label className={s.field}>
          <span>Reporting period</span>
          <select
            value={preset}
            onChange={(event) => {
              const next = event.target.value as Preset;
              onPresetChange(next);
            }}
          >
            {(Object.keys(PRESET_LABELS) as Preset[]).map((key) => (
              <option key={key} value={key}>
                {PRESET_LABELS[key]}
              </option>
            ))}
          </select>
        </label>

        <label className={s.field}>
          <span>Attribution</span>
          <select value={model} onChange={(event) => onModelChange(event.target.value as AttributionModel)}>
            <option value="first_touch">First touch</option>
            <option value="last_touch">Last touch</option>
            <option value="last_non_direct">Last non-direct</option>
          </select>
        </label>

        <form
          className={s.field}
          onSubmit={(event) => {
            event.preventDefault();
            onConversionEventChange(conversionDraft.trim());
          }}
        >
          <span>Conversion event</span>
          <div className={s.inlineForm}>
            <input
              type="text"
              maxLength={64}
              value={conversionDraft}
              onChange={(event) => setConversionDraft(event.target.value)}
              placeholder="e.g. signup"
              aria-label="Conversion event name"
            />
            <button type="submit">Apply</button>
            {conversionEvent && (
              <button
                type="button"
                onClick={() => {
                  setConversionDraft('');
                  onConversionEventChange('');
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>

        <span className={s.timezone} title="All reporting dates use UTC calendar days">
          Timezone: UTC
        </span>

        <div className={s.refreshGroup}>
          {onRefresh && (
            <button className={s.applyButton} type="button" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh data'}
            </button>
          )}
          {updatedLabel && <span className={s.timezone}>{updatedLabel}</span>}
        </div>
      </div>

      {preset === 'custom' && (
        <div className={s.customRow}>
          <label className={s.field}>
            <span>From</span>
            <input
              type="date"
              value={draft.start}
              max={draft.end || today}
              onChange={(event) => onDraftChange({ ...draft, start: event.target.value })}
            />
          </label>
          <label className={s.field}>
            <span>To</span>
            <input
              type="date"
              value={draft.end}
              max={today}
              onChange={(event) => onDraftChange({ ...draft, end: event.target.value })}
            />
          </label>
          <button className={s.applyButton} type="button" disabled={invalid} onClick={onApplyRange}>
            Apply dates
          </button>
          {invalid && <span className={s.fieldHint}>Choose up to 90 days ending no later than today.</span>}
        </div>
      )}

      <p className={s.toolbarNote}>
        {range.start} – {range.end} UTC · every section on this page uses this window
        {conversionEvent ? ` · conversions count visitors who triggered “${conversionEvent}”` : ' · no conversion event selected yet'}
        .
      </p>
    </div>
  );
}
