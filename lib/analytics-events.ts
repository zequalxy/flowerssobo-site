/** Fixed counters only: never extend this with URLs, IDs or customer input. */
export const ANALYTICS_METRICS = [
  "active_visit", "home_view", "flowers_view", "bouquets_view", "categories_view",
  "season_view", "reviews_view", "faq_view", "contacts_view", "bouquet_open",
  "bouquet_add", "flower_add", "cart_add", "cart_view", "order_start", "order_submit",
  "order_success", "phone_click", "telegram_click", "instagram_click", "category_mono",
  "category_giant", "category_trend", "category_custom", "category_wedding",
  "category_interior", "category_jute", "category_business",
] as const;

export type AnalyticsMetric = (typeof ANALYTICS_METRICS)[number];

const metrics: ReadonlySet<string> = new Set(ANALYTICS_METRICS);
export function isAnalyticsMetric(value: unknown): value is AnalyticsMetric {
  return typeof value === "string" && metrics.has(value);
}
