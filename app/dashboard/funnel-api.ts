export type FunnelRange = { start: string; end: string };

/** Keep a valid, distinct selection and ensure the minimum two observed events are selected. */
export function normalizeFunnelSteps(current: readonly string[], observedNames: readonly string[]): string[] {
  const names = [...new Set(observedNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length < 2) return [];

  const selected: string[] = [];
  for (const name of current) {
    if (names.includes(name) && !selected.includes(name) && selected.length < 5) selected.push(name);
  }
  for (const name of names) {
    if (selected.length >= 2 || selected.length >= 5) break;
    if (!selected.includes(name)) selected.push(name);
  }
  return selected;
}

/** Append only an unused observed event; a full selection is returned unchanged. */
export function appendFunnelStep(current: readonly string[], observedNames: readonly string[]): string[] {
  if (current.length >= 5) return [...current];
  const next = [...new Set(observedNames.map((name) => name.trim()).filter(Boolean))]
    .find((name) => !current.includes(name));
  return next ? [...current, next] : [...current];
}

/** Reject a duplicate selection rather than sending an ambiguous funnel to the API. */
export function selectFunnelStep(current: readonly string[], index: number, name: string): string[] {
  if (index < 0 || index >= current.length || !name.trim()) return [...current];
  if (current.some((existing, stepIndex) => stepIndex !== index && existing === name)) return [...current];
  return current.map((existing, stepIndex) => (stepIndex === index ? name : existing));
}

/** Build a request using the established two-step route or the multi-step repeated-parameter route. */
export function buildFunnelRequest(projectId: string, range: FunnelRange | null, steps: readonly string[]): string {
  const names = steps.map((name) => name.trim());
  if (names.length < 2 || names.length > 5 || names.some((name) => !name || name.length > 64)) {
    throw new Error('A funnel requires 2–5 non-empty event names, each no longer than 64 characters.');
  }
  if (new Set(names).size !== names.length) {
    throw new Error('Choose a different observed event for each funnel step.');
  }

  const params = new URLSearchParams({ days: '30', ...(range ?? {}) });
  const base = `/api/projects/${encodeURIComponent(projectId)}/funnel`;
  if (names.length === 2) {
    params.set('first', names[0]);
    params.set('second', names[1]);
    return `${base}?${params.toString()}`;
  }

  names.forEach((name) => params.append('steps', name));
  return `${base}/multi?${params.toString()}`;
}
