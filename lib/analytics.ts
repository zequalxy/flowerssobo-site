import type { AnalyticsMetric } from "./analytics-events";

type CollectorOptions = {
  metrics: readonly AnalyticsMetric[];
  send: (metrics: AnalyticsMetric[]) => void | Promise<unknown>;
  schedule?: (callback: () => void) => unknown;
  cancel?: (handle: unknown) => void;
};

/** Browser privacy preferences are checked before config requests and every batch. */
export function analyticsOptOut(preferences: {
  doNotTrack?: string | null;
  windowDoNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}): boolean {
  return preferences.globalPrivacyControl === true ||
    [preferences.doNotTrack, preferences.windowDoNotTrack].some((value) => value === "1" || value === "yes");
}

/** One document's memory only. No visitor identity, persistence or event history. */
export function createAnalyticsCollector({ metrics, send, schedule, cancel }: CollectorOptions) {
  const allowed = new Set<string>(metrics);
  const seen = new Set<AnalyticsMetric>();
  const pending = new Set<AnalyticsMetric>();
  let enabled: boolean | null = null;
  let active = false;
  let timer: unknown = null;
  const later = schedule ?? ((callback: () => void) => setTimeout(callback, 250));
  const cancelLater = cancel ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  function flush() {
    if (timer !== null) cancelLater(timer);
    timer = null;
    if (!enabled || !active || !pending.size) return;
    // The denominator goes in the same first batch, even if views were queued first.
    const batch = [...pending];
    if (pending.has("active_visit")) {
      batch.splice(batch.indexOf("active_visit"), 1);
      batch.unshift("active_visit");
    }
    pending.clear();
    // Marked before sending: a failed/ambiguous response must never be retried.
    try { void Promise.resolve(send(batch)).catch(() => {}); } catch { /* Analytics cannot break shopping. */ }
  }

  function enqueue() {
    if (enabled && active && pending.size && timer === null) timer = later(flush);
  }

  function record(metric: AnalyticsMetric) {
    if (enabled === false || !allowed.has(metric) || seen.has(metric)) return;
    seen.add(metric);
    pending.add(metric);
    enqueue();
  }

  return {
    record,
    /** UI actions cannot count unless a trusted interaction already activated the document. */
    action(metric: AnalyticsMetric) { if (active) record(metric); },
    activate(isTrusted: boolean, visible: boolean) {
      if (!isTrusted || !visible || enabled === false) return;
      active = true;
      record("active_visit");
    },
    setEnabled(value: boolean) {
      enabled = value;
      if (!value) {
        if (timer !== null) cancelLater(timer);
        timer = null;
        pending.clear();
      } else enqueue();
    },
    flush,
  };
}

/** Used only by successful user quantity changes, never by cart restoration. */
export function cartIncreaseMetrics(previous: number, next: number, kind: string): AnalyticsMetric[] {
  if (!Number.isSafeInteger(previous) || !Number.isSafeInteger(next) || previous < 0 || next <= previous) return [];
  if (kind === "bouquet") return ["cart_add", "bouquet_add"];
  if (kind === "flower") return ["cart_add", "flower_add"];
  return kind === "packaging" ? ["cart_add"] : [];
}
