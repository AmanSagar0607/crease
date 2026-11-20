'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { Range } from './reporting';
import s from './sections.module.css';
import { Table } from '@/components/ui/table';

type Goal = {
  id: string;
  name: string;
  event_name: string;
  target_count: number;
  current_count: number;
  progress: number;
  start: string;
  end: string;
};

type Props = {
  projectId: string;
  range: Range;
};

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Could not load project data (${response.status}).`);
  return response.json() as Promise<T>;
}

export default function GoalsSection({ projectId, range }: Props) {
  const key = `/api/projects/${encodeURIComponent(projectId)}/goals?start=${range.start}&end=${range.end}`;
  const eventsKey = `/api/projects/${encodeURIComponent(projectId)}/goal-events`;
  const { data: goals, error, isLoading } = useSWR<Goal[]>(key, fetcher);
  const { data: availableEvents } = useSWR<{ label: string; count: number }[]>(eventsKey, fetcher);
  const events = availableEvents ?? [];
  const { mutate } = useSWRConfig();
  const [name, setName] = useState('');
  const [eventName, setEventName] = useState(events[0]?.label ?? '');
  const [targetCount, setTargetCount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  function resetForm() {
    setName('');
    setEventName(events[0]?.label ?? '');
    setTargetCount('');
    setEditingId(null);
  }

  function editGoal(goal: Goal) {
    setName(goal.name);
    setEventName(goal.event_name);
    setTargetCount(String(goal.target_count));
    setEditingId(goal.id);
    setMessage('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selectedEvent = eventName || events[0]?.label;
    if (!name.trim() || !selectedEvent || !Number.isSafeInteger(Number(targetCount)) || Number(targetCount) < 1) return;
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/goals${editingId ? `/${encodeURIComponent(editingId)}` : ''}`,
        {
          method: editingId ? 'PATCH' : 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), event_name: selectedEvent, target_count: Number(targetCount) }),
        },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(typeof result?.detail === 'string' ? result.detail : 'Could not save this goal.');
      }
      resetForm();
      await mutate(key);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not save this goal.');
    } finally {
      setSaving(false);
    }
  }

  async function removeGoal(goal: Goal) {
    if (!window.confirm(`Delete “${goal.name}”?`)) return;
    setMessage('');
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/goals/${encodeURIComponent(goal.id)}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      });
      if (!response.ok) throw new Error('Could not delete this goal.');
      if (editingId === goal.id) resetForm();
      await mutate(key);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Could not delete this goal.');
    }
  }

  function guardImeSubmit(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
  }

  return (
    <section className={s.section} aria-labelledby="goals-title">
      <header className={s.head}>
        <div>
          <span className={s.eyebrow}>MEASURE WHAT MATTERS</span>
          <h2 id="goals-title">Goals</h2>
          <p>Set a target for an observed event and track its count in the shared UTC reporting window.</p>
        </div>
      </header>

      <form className={s.toolbar} onSubmit={submit} onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault();
      }}>
        <div className={s.toolbarRow}>
          <label className={s.field}>
            <span>Goal name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={guardImeSubmit} maxLength={80} required placeholder="e.g. Newsletter signups" />
          </label>
          <label className={s.field}>
            <span>Observed event</span>
            <select value={eventName || events[0]?.label || ''} onChange={(event) => setEventName(event.target.value)} required disabled={!events.length}>
              {eventName && !events.some((item) => item.label === eventName) && <option value={eventName}>{eventName}</option>}
              {events.length ? events.map((item) => <option key={item.label} value={item.label}>{item.label}</option>) : <option value="">No observed events yet</option>}
            </select>
          </label>
          <label className={s.field}>
            <span>Event target</span>
            <input type="number" min="1" max="1000000000" step="1" inputMode="numeric" value={targetCount} onChange={(event) => setTargetCount(event.target.value)} required placeholder="100" />
          </label>
          <button className={s.applyButton} type="submit" disabled={saving || !events.length}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create goal'}
          </button>
          {editingId && <button className={s.applyButton} type="button" onClick={resetForm}>Cancel</button>}
        </div>
        <p className={s.toolbarNote}>Counts are raw occurrences of the selected event. Goals are project-scoped; the current count follows the date range above.</p>
      </form>

      {message && <p role="alert" className={s.note}>{message}</p>}
      {isLoading ? <p className={s.note} role="status">Loading goals…</p> : error ? (
        <div className={s.panel} role="alert"><p>{error.message}</p><button className={s.applyButton} type="button" onClick={() => void mutate(key)}>Try again</button></div>
      ) : goals?.length ? (
        <div className={s.panel}>
          <div className={s.panelHead}><h3>Progress</h3><span>{range.start} – {range.end} UTC</span></div>
          <div className={s.scroll}>
            <Table className={s.table}>
              <thead><tr><th scope="col">Goal</th><th scope="col">Event</th><th scope="col" className={s.num}>Current</th><th scope="col" className={s.num}>Target</th><th scope="col">Progress</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>{goals.map((goal) => <tr key={goal.id}>
                <th scope="row">{goal.name}</th>
                <td>{goal.event_name}</td>
                <td className={s.num}>{goal.current_count.toLocaleString()}</td>
                <td className={s.num}>{goal.target_count.toLocaleString()}</td>
                <td><progress aria-label={`${goal.name} progress`} value={goal.progress} max={1}>{Math.round(goal.progress * 100)}%</progress> {Math.round(goal.progress * 100)}%</td>
                <td><div className={s.pager}><button className={s.applyButton} type="button" onClick={() => editGoal(goal)}>Edit</button><button className={s.applyButton} type="button" onClick={() => void removeGoal(goal)} aria-label={`Delete ${goal.name}`}>Delete</button></div></td>
              </tr>)}</tbody>
            </Table>
          </div>
        </div>
      ) : <div className={s.panel}>
        <h3>No goals yet</h3>
        <p className={s.note}>{events.length ? 'Create a goal using an event that Zappa has already observed. Its progress will reflect real event counts in the selected date range.' : 'Once this project receives events, you can set a target for one of them. No sample metrics are shown.'}</p>
      </div>}
    </section>
  );
}
