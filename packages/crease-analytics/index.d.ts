export type AnalyticsOptions = { projectId: string; writeKey: string; endpoint?: string; enabled?: boolean };
export type AnalyticsClient = { track(name: string, properties?: Record<string, string | number | boolean>): void; page(): void; flush(): void; identify(): string | undefined; reset(): void; optOut(): void; destroy(): void };
export function init(options: AnalyticsOptions): AnalyticsClient;
