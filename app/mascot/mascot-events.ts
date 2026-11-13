export type MascotEventKind = 'project-created' | 'first-pageview';

export type MascotEventDetail = {
  kind: MascotEventKind;
  projectName: string;
};

const MASCOT_EVENT = 'crease:mascot';

export function dispatchMascotEvent(detail: MascotEventDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<MascotEventDetail>(MASCOT_EVENT, { detail }));
}

export function subscribeMascotEvents(listener: (detail: MascotEventDetail) => void) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<MascotEventDetail>).detail;
    if (detail?.kind) listener(detail);
  };

  window.addEventListener(MASCOT_EVENT, handler);
  return () => window.removeEventListener(MASCOT_EVENT, handler);
}

export function mascotEventCopy(detail: MascotEventDetail) {
  if (detail.kind === 'project-created') {
    return {
      title: 'First project created',
      body: `${detail.projectName} is in your workspace. Install the tracker when you're ready.`,
    };
  }

  return {
    title: 'First pageview received',
    body: `${detail.projectName} is live. The tracker is working.`,
  };
}
