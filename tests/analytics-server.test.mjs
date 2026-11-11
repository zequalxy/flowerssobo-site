import assert from "node:assert/strict";
import { test } from "node:test";
import { ANALYTICS_METRICS } from "../lib/analytics-events.ts";
import { analyticsRateLimit, createAnalyticsHandlers } from "../lib/analytics-server.ts";

const origin = "https://flowers.example";
const config = { baseUrl: "https://stebel.example/api", key: "stebel_site_test_secret" };

function request(payload = { metrics: ["active_visit", "flowers_view"] }, headers = {}, path = "/api/analytics") {
  return new Request(`${origin}${path}`, {
    method: "POST",
    headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", ...headers },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

function setup(overrides = {}) {
  const calls = [];
  const handlers = createAnalyticsHandlers({
    enabled: () => true,
    config: () => config,
    metrics: ANALYTICS_METRICS,
    fetch: async (...args) => { calls.push(args); return new Response(null, { status: 204 }); },
    ...overrides,
  });
  return { ...handlers, calls };
}

test("only fixed metric constants and the server key are forwarded", async () => {
  const handlers = setup();
  const result = await handlers.POST(request(undefined, {
    cookie: "visitor=private", authorization: "private", "user-agent": "private",
    "x-forwarded-for": "192.0.2.1", referer: `${origin}/?phone=private`,
  }));
  assert.equal(result.status, 204);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal(handlers.calls.length, 1);
  const [url, init] = handlers.calls[0];
  assert.equal(url, `${config.baseUrl}/site/analytics`);
  assert.deepEqual(init.headers, { "Content-Type": "application/json", "X-Stebel-Key": config.key });
  assert.deepEqual(JSON.parse(init.body), { metrics: ["active_visit", "flowers_view"] });
  assert.equal(init.credentials, "omit");
  assert.equal(init.referrerPolicy, "no-referrer");
  assert.equal(init.redirect, "error");
  assert.equal(init.cache, "no-store");
  assert.ok(init.signal instanceof AbortSignal);
});

test("runtime flag and missing configuration disable the browser without leaking secrets", async () => {
  let enabled = false;
  const handlers = setup({ enabled: () => enabled });
  assert.deepEqual(await handlers.GET().json(), { enabled: false });
  assert.equal((await handlers.POST(request())).status, 204);
  assert.equal(handlers.calls.length, 0);
  enabled = true;
  assert.deepEqual(await handlers.GET().json(), { enabled: true });
  assert.equal(handlers.GET().headers.get("cache-control"), "no-store");
  const missing = setup({ config: () => null });
  assert.deepEqual(await missing.GET().json(), { enabled: false });
  assert.equal((await missing.POST(request())).status, 503);
  assert.equal(missing.calls.length, 0);
});

test("DNT and GPC requests do not reach storage", async () => {
  for (const headers of [{ dnt: "1" }, { "sec-gpc": "1" }]) {
    const handlers = setup();
    assert.equal((await handlers.POST(request(undefined, headers))).status, 204);
    assert.equal(handlers.calls.length, 0);
  }
});

test("cross-origin submissions, query strings and non-JSON requests are rejected", async () => {
  const foreign = request(undefined, { origin: "https://elsewhere.example" });
  foreign.headers.delete("sec-fetch-site");
  const unknown = request(undefined, { origin: "null" });
  unknown.headers.delete("sec-fetch-site");
  for (const [req, status] of [
    [foreign, 403],
    [unknown, 403],
    [request(undefined, { "sec-fetch-site": "cross-site" }), 403],
    [request(undefined, { "sec-fetch-site": "same-site" }), 403],
    [request(undefined, {}, "/api/analytics?email=private"), 400],
    [request(undefined, { "content-type": "text/plain" }), 415],
  ]) {
    const handlers = setup();
    assert.equal((await handlers.POST(req)).status, status);
    assert.equal(handlers.calls.length, 0);
  }
});

test("browser same-origin metadata works behind a reverse proxy with an internal request URL", async () => {
  const handlers = setup();
  const req = new Request("http://0.0.0.0:3000/api/analytics", {
    method: "POST", headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json" },
    body: JSON.stringify({ metrics: ["active_visit"] }),
  });
  assert.equal((await handlers.POST(req)).status, 204);
  assert.equal((await handlers.POST(request(undefined, { origin: "null" }))).status, 204);
  const legacy = request();
  legacy.headers.delete("sec-fetch-site");
  assert.equal((await handlers.POST(legacy)).status, 204);
});

test("unknown dimensions, free text, duplicate metrics and malformed bodies are rejected", async () => {
  for (const payload of [
    {}, [], null, { metrics: [] }, { metrics: "active_visit" },
    { metrics: ["active_visit"], email: "private@example.com" },
    { metrics: ["active_visit"], url: "/private" },
    { metrics: ["active_visit", "active_visit"] }, { metrics: ["private@example.com"] },
    { metrics: [42] }, { metrics: [null] }, { metrics: [{ name: "active_visit" }] },
    "{broken", " ".repeat(2049),
  ]) {
    const handlers = setup();
    assert.equal((await handlers.POST(request(payload))).status, 400);
    assert.equal(handlers.calls.length, 0);
  }
  const all = setup();
  assert.equal((await all.POST(request({ metrics: ANALYTICS_METRICS }))).status, 204);
});

test("body limits cover both content-length and chunked bodies", async () => {
  const handlers = setup();
  assert.equal((await handlers.POST(request(undefined, { "content-length": "9000" }))).status, 400);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"metrics":["active_visit"]}'));
      controller.enqueue(new Uint8Array(2048));
      controller.close();
    },
  });
  const streamed = new Request(`${origin}/api/analytics`, {
    method: "POST", duplex: "half", body,
    headers: { origin, "content-type": "application/json" },
  });
  assert.equal((await handlers.POST(streamed)).status, 400);
  assert.equal(handlers.calls.length, 0);
});

test("backend failures are not retried or exposed", async () => {
  for (const status of [200, 401, 429, 500]) {
    let attempts = 0;
    const handlers = setup({ fetch: async () => {
      attempts++;
      return new Response(`secret: ${config.key}`, { status });
    } });
    const response = await handlers.POST(request());
    assert.equal(response.status, 502);
    assert.equal(await response.text(), "");
    assert.equal(attempts, 1);
  }
  let attempts = 0;
  const unavailable = setup({ fetch: async () => { attempts++; throw new Error(config.key); } });
  assert.equal((await unavailable.POST(request())).status, 503);
  assert.equal(attempts, 1);
});

test("a stalled request body is canceled without reaching the backend", async () => {
  let canceled = false;
  const body = new ReadableStream({ cancel() { canceled = true; } });
  const handlers = setup();
  const req = new Request(`${origin}/api/analytics`, {
    method: "POST", duplex: "half", body,
    headers: { origin, "content-type": "application/json" },
  });
  assert.equal((await handlers.POST(req)).status, 400);
  assert.equal(canceled, true);
  assert.equal(handlers.calls.length, 0);
});

test("aggregate rate limit is bounded and resets without storing request identities", async () => {
  let time = 1000;
  const allow = analyticsRateLimit(2, () => time);
  const handlers = setup({ allow });
  assert.equal((await handlers.POST(request())).status, 204);
  assert.equal((await handlers.POST(request())).status, 204);
  assert.equal((await handlers.POST(request())).status, 429);
  assert.equal(handlers.calls.length, 2);
  time += 60_000;
  assert.equal((await handlers.POST(request())).status, 204);
});
