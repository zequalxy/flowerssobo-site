import type { AnalyticsMetric } from "./analytics-events";

type Config = { baseUrl: string; key: string };
type Options = {
  enabled: () => boolean;
  config: () => Config | null;
  metrics: readonly AnalyticsMetric[];
  fetch?: typeof fetch;
  allow?: () => boolean;
};

const MAX_BODY_BYTES = 2048;
const RESPONSE_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** One bounded counter per process, deliberately without IPs or visitor keys. */
export function analyticsRateLimit(limit = 600, now: () => number = Date.now): () => boolean {
  let windowStart = now();
  let used = 0;
  return () => {
    const current = now();
    if (current - windowStart >= 60_000 || current < windowStart) {
      windowStart = current;
      used = 0;
    }
    return ++used <= limit;
  };
}

function empty(status = 204): Response {
  return new Response(null, { status, headers: RESPONSE_HEADERS });
}

async function readMetrics(request: Request, allowed: ReadonlySet<string>): Promise<AnalyticsMetric[]> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
    throw new Error("body_limit");
  }
  if (!request.body) throw new Error("missing_body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      void reader.cancel().catch(() => {});
      reject(new Error("body_timeout"));
    }, 2_000);
  });
  try {
    await Promise.race([deadline, (async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) {
          void reader.cancel().catch(() => {});
          throw new Error("body_limit");
        }
        chunks.push(value);
      }
    })()]);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const data: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid_body");
  const record = data as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || !Array.isArray(record.metrics)) throw new Error("invalid_body");
  const metrics = record.metrics;
  if (!metrics.length || metrics.length > allowed.size ||
      metrics.some((metric) => typeof metric !== "string" || !allowed.has(metric)) ||
      new Set(metrics).size !== metrics.length) throw new Error("invalid_metrics");
  // Only allowlisted constants cross the boundary; never forward the original body.
  return metrics as AnalyticsMetric[];
}

/** The ordinary Request/Response boundary can be tested without a Next server. */
export function createAnalyticsHandlers(options: Options) {
  const allowed = new Set<string>(options.metrics);
  const allow = options.allow ?? analyticsRateLimit();
  const send = options.fetch ?? fetch;
  return {
    GET(): Response {
      return Response.json({ enabled: options.enabled() && options.config() !== null }, { headers: RESPONSE_HEADERS });
    },
    async POST(request: Request): Promise<Response> {
      if (!options.enabled() || request.headers.get("dnt") === "1" || request.headers.get("sec-gpc") === "1") return empty();
      const url = new URL(request.url);
      const site = request.headers.get("sec-fetch-site");
      // Browser-controlled Fetch Metadata survives a reverse proxy whose internal
      // request.url is http://0.0.0.0:3000. Script cannot forge Sec-* headers.
      // Older clients without that header must supply an exact matching Origin.
      if (site !== null ? site !== "same-origin" : request.headers.get("origin") !== url.origin) return empty(403);
      if (url.search) return empty(400);
      if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return empty(415);
      if (!allow()) return empty(429);
      let metrics: AnalyticsMetric[];
      try { metrics = await readMetrics(request, allowed); }
      catch { return empty(400); }
      const config = options.config();
      if (!config) return empty(503);
      try {
        const response = await send(`${config.baseUrl}/site/analytics`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Stebel-Key": config.key },
          body: JSON.stringify({ metrics }),
          credentials: "omit",
          referrerPolicy: "no-referrer",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(2_000),
        });
        // No backend response bodies, keys or request metadata enter logs or responses.
        await response.body?.cancel();
        return empty(response.status === 204 ? 204 : 502);
      } catch {
        // Never retry: the first attempt may already have incremented the aggregate.
        return empty(503);
      }
    },
  };
}
