import assert from "node:assert/strict";
import { test } from "node:test";
import { ANALYTICS_METRICS, isAnalyticsMetric } from "../lib/analytics-events.ts";
import { analyticsOptOut, cartIncreaseMetrics, createAnalyticsCollector } from "../lib/analytics.ts";

function harness(send) {
  const batches = [];
  const scheduled = new Map();
  let sequence = 0;
  const collector = createAnalyticsCollector({
    metrics: ANALYTICS_METRICS,
    send: send ?? ((metrics) => batches.push(metrics)),
    schedule(callback) { const id = ++sequence; scheduled.set(id, callback); return id; },
    cancel(id) { scheduled.delete(id); },
  });
  return {
    collector, batches, scheduled,
    tick() { for (const callback of [...scheduled.values()]) callback(); },
  };
}

test("allowlist contains exactly the agreed 28 counters and rejects arbitrary payloads", () => {
  assert.equal(ANALYTICS_METRICS.length, 28);
  assert.equal(new Set(ANALYTICS_METRICS).size, 28);
  for (const metric of ANALYTICS_METRICS) assert.equal(isAnalyticsMetric(metric), true);
  for (const value of [null, 1, {}, "https://example.com/?phone=123", "order_id", "customer@example.com", "__proto__"]) {
    assert.equal(isAnalyticsMetric(value), false);
  }
});

test("DNT and Global Privacy Control independently opt out", () => {
  assert.equal(analyticsOptOut({}), false);
  assert.equal(analyticsOptOut({ doNotTrack: "0", globalPrivacyControl: false }), false);
  for (const preferences of [
    { doNotTrack: "1" }, { doNotTrack: "yes" }, { windowDoNotTrack: "1" },
    { windowDoNotTrack: "yes" }, { globalPrivacyControl: true },
  ]) assert.equal(analyticsOptOut(preferences), true);
});

test("passive page views, hidden interactions and synthetic interactions send nothing", () => {
  const { collector, batches, scheduled } = harness();
  collector.setEnabled(true);
  collector.record("home_view");
  collector.record("season_view");
  collector.action("order_start");
  collector.activate(false, true);
  collector.activate(true, false);
  collector.flush();
  assert.deepEqual(batches, []);
  assert.equal(scheduled.size, 0);
});

test("early trusted interaction waits for runtime enable and batches active visit before queued views", () => {
  const { collector, batches, scheduled, tick } = harness();
  collector.record("home_view");
  collector.record("season_view");
  collector.activate(true, true);
  collector.action("bouquet_open");
  collector.flush();
  assert.deepEqual(batches, []);
  collector.setEnabled(true);
  assert.equal(scheduled.size, 1);
  tick();
  assert.deepEqual(batches, [["active_visit", "home_view", "season_view", "bouquet_open"]]);
});

test("disabled analytics discards queued events and never schedules network work", () => {
  const { collector, batches, scheduled, tick } = harness();
  collector.record("home_view");
  collector.activate(true, true);
  collector.setEnabled(false);
  collector.action("order_success");
  collector.record("flowers_view");
  collector.activate(true, true);
  collector.flush();
  tick();
  assert.deepEqual(batches, []);
  assert.equal(scheduled.size, 0);
});

test("route changes and repeated effect setup preserve one count per document", () => {
  const { collector, batches, scheduled, tick } = harness();
  for (let effect = 0; effect < 3; effect += 1) {
    collector.record("home_view");
    collector.setEnabled(true);
    collector.activate(true, true);
    collector.action("cart_add");
  }
  assert.equal(scheduled.size, 1);
  tick();
  collector.record("flowers_view");
  collector.action("cart_add");
  collector.record("home_view");
  collector.activate(true, true);
  tick();
  assert.deepEqual(batches, [["active_visit", "home_view", "cart_add"], ["flowers_view"]]);
});

test("pagehide/manual flush cancels debounce; later flushes cannot resend a batch", () => {
  const { collector, batches, scheduled, tick } = harness();
  collector.setEnabled(true);
  collector.activate(true, true);
  collector.action("phone_click");
  collector.flush();
  assert.equal(scheduled.size, 0);
  tick();
  collector.flush();
  collector.action("phone_click");
  assert.deepEqual(batches, [["active_visit", "phone_click"]]);
});

test("opt-out after activation cancels a pending batch", () => {
  const { collector, batches, scheduled, tick } = harness();
  collector.setEnabled(true);
  collector.activate(true, true);
  collector.record("home_view");
  collector.setEnabled(false);
  tick();
  collector.flush();
  assert.equal(scheduled.size, 0);
  assert.deepEqual(batches, []);
});

test("sync/async analytics failure cannot escape into ordering and cannot retry", async () => {
  for (const asynchronous of [false, true]) {
    let attempts = 0;
    const { collector, tick } = harness(() => {
      attempts += 1;
      if (asynchronous) return Promise.reject(new Error("offline"));
      throw new Error("offline");
    });
    collector.setEnabled(true);
    collector.activate(true, true);
    collector.action("order_success");
    assert.doesNotThrow(tick);
    await Promise.resolve();
    collector.action("order_success");
    collector.flush();
    tick();
    assert.equal(attempts, 1);
  }
});

test("even invalid JS input and repeated metrics cannot expand the bounded batch", () => {
  const { collector, batches, tick } = harness();
  collector.setEnabled(true);
  collector.record("visitor@example.com");
  collector.record({ phone: "+79991234567" });
  collector.activate(true, true);
  for (let repetition = 0; repetition < 3; repetition += 1) {
    for (const metric of ANALYTICS_METRICS) collector.record(metric);
  }
  tick();
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 28);
  assert.deepEqual(new Set(batches[0]), new Set(ANALYTICS_METRICS));
});

test("cart metrics require an actual positive increase; packaging is not a flower", () => {
  assert.deepEqual(cartIncreaseMetrics(0, 1, "bouquet"), ["cart_add", "bouquet_add"]);
  assert.deepEqual(cartIncreaseMetrics(2, 5, "flower"), ["cart_add", "flower_add"]);
  assert.deepEqual(cartIncreaseMetrics(0, 1, "packaging"), ["cart_add"]);
  for (const [previous, next] of [[1, 1], [2, 1], [2, 0], [0, 0], [-1, 1], [0, 1.5], [0, NaN]]) {
    assert.deepEqual(cartIncreaseMetrics(previous, next, "flower"), []);
  }
  assert.deepEqual(cartIncreaseMetrics(0, 1, "supplier"), []);
});
