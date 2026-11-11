import { ANALYTICS_METRICS } from "@/lib/analytics-events";
import { createAnalyticsHandlers } from "@/lib/analytics-server";
import { readStebelConfig } from "@/lib/stebel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createAnalyticsHandlers({
  enabled: () => process.env.SITE_ANALYTICS_ENABLED === "1",
  config: readStebelConfig,
  metrics: ANALYTICS_METRICS,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
