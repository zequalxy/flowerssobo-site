"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { ANALYTICS_METRICS, isAnalyticsMetric, type AnalyticsMetric } from "@/lib/analytics-events";
import { analyticsOptOut, createAnalyticsCollector } from "@/lib/analytics";

// Reused across route changes and StrictMode effects, discarded on a real reload.
let collector: ReturnType<typeof createAnalyticsCollector> | null = null;
let configuration: Promise<boolean> | null = null;
let installations = 0;

async function analyticsRequest(options: RequestInit): Promise<Response> {
  // AbortSignal.timeout is absent in some installed iOS web apps. Async setup also
  // turns missing browser APIs into a caught analytics failure, never a render error.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    return await fetch("/api/analytics", {
      ...options, credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store",
      signal: controller.signal,
    });
  } finally { clearTimeout(timer); }
}

function optedOut() {
  return analyticsOptOut({
    doNotTrack: navigator.doNotTrack,
    windowDoNotTrack: (window as Window & { doNotTrack?: string }).doNotTrack,
    globalPrivacyControl: (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
  });
}

function currentCollector() {
  if (!collector) {
    collector = createAnalyticsCollector({
      metrics: ANALYTICS_METRICS,
      send(metrics) {
        if (optedOut()) return;
        return analyticsRequest({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ metrics }),
          keepalive: true,
        });
      },
    });
  }
  return collector;
}

/** Only fixed metric names may enter the collector, never form/cart values. */
export function trackAnalytics(metric: AnalyticsMetric) {
  if (!installations || typeof window === "undefined" || optedOut()) return;
  collector?.action(metric);
}

export function AnalyticsProvider() {
  const pathname = usePathname();

  useEffect(() => {
    if (optedOut()) return;
    const analytics = currentCollector();
    installations += 1;
    let live = true;
    const visible = () => document.visibilityState === "visible";
    const recordPage = () => {
      if (!visible()) return;
      if (pathname === "/") analytics.record("home_view");
      if (pathname === "/flowers" || pathname === "/flowers/") analytics.record("flowers_view");
    };
    recordPage();

    // Runtime config avoids freezing a Docker build-time flag into static pages.
    configuration ??= analyticsRequest({}).then(async (response) => response.ok && (await response.json() as { enabled?: unknown }).enabled === true).catch(() => false);
    void configuration.then((enabled) => { if (live) analytics.setEnabled(enabled && !optedOut()); });

    const element = (event: Event) => event.target instanceof Element ? event.target : null;
    const onInteraction = (event: Event) => {
      if (optedOut()) { analytics.setEnabled(false); return; }
      analytics.activate(event.isTrusted, visible());
      const control = element(event)?.closest("input, textarea, select, button");
      if ((event.type === "pointerdown" || event.type === "keydown") && event.isTrusted && visible() && control?.closest("form[data-analytics-order]")) analytics.action("order_start");
    };
    const onClick = (event: Event) => {
      if (!event.isTrusted || !visible() || optedOut()) return;
      const metric = element(event)?.closest("[data-analytics-event]")?.getAttribute("data-analytics-event");
      if (isAnalyticsMetric(metric)) analytics.action(metric);
    };
    const onFocus = (event: Event) => {
      if (event.isTrusted && visible() && !optedOut() && element(event)?.closest("form[data-analytics-order]")) analytics.action("order_start");
    };
    // Capture runs before React handlers that change the cart or submit an order.
    const interactions = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of interactions) document.addEventListener(name, onInteraction, { capture: true, passive: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("focusin", onFocus, true);

    const observed = new WeakSet<Element>();
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((entries) => {
      if (!visible() || optedOut()) return;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const metric = entry.target.getAttribute("data-analytics-view");
        if (isAnalyticsMetric(metric)) analytics.record(metric);
      }
    }, { threshold: 0.1 });
    const observe = () => {
      if (!observer) return;
      for (const node of document.querySelectorAll("[data-analytics-view]")) {
        if (!observed.has(node)) { observed.add(node); observer.observe(node); }
      }
    };
    observe();
    // Cart blocks and route sections can appear after the initial render.
    const mutations = typeof MutationObserver === "undefined" ? null : new MutationObserver(observe);
    mutations?.observe(document.body, { childList: true, subtree: true });
    const onVisibility = () => {
      if (!visible()) analytics.flush();
      else {
        recordPage();
        // Recheck intersections suppressed while this tab was hidden.
        for (const node of document.querySelectorAll("[data-analytics-view]")) {
          observer?.unobserve(node);
          observer?.observe(node);
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", analytics.flush);
    return () => {
      live = false;
      installations -= 1;
      for (const name of interactions) document.removeEventListener(name, onInteraction, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("focusin", onFocus, true);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", analytics.flush);
      mutations?.disconnect();
      observer?.disconnect();
      // Keep document-level deduplication and the config promise across remounts.
    };
  }, [pathname]);

  return null;
}
