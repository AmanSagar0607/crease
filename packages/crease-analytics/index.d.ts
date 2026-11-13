export type AnalyticsOptions = { projectId: string; endpoint?: string };
export type AnalyticsClient = { track(name: string, properties?: Record<string, string | number | boolean>): void; page(): void; destroy(): void };
export function init(options: AnalyticsOptions): AnalyticsClient;
