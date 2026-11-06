import test from "node:test";
import assert from "node:assert/strict";
import { stebelApiBase } from "../lib/stebel-url.ts";
import { catalogFailureHint, safeCatalogDiagnostic } from "../lib/storefront-diagnostics.ts";

test("bare Stebel origin resolves to API, not the SPA HTML page", () => {
  assert.equal(stebelApiBase(new URL("https://stebel.tech")), "https://stebel.tech/api");
  assert.equal(stebelApiBase(new URL("https://stebel.tech/")), "https://stebel.tech/api");
});

test("existing API path is not duplicated and custom prefixes are preserved", () => {
  assert.equal(stebelApiBase(new URL("https://stebel.tech/api/")), "https://stebel.tech/api");
  assert.equal(stebelApiBase(new URL("https://example.test/crm/api/")), "https://example.test/crm/api");
});

test("catalog logs distinguish API authentication from the stand password", () => {
  assert.match(catalogFailureHint(401, "application/json"), /ключ/);
  assert.match(catalogFailureHint(401, "text/html"), /пароль стенда/);
  assert.match(catalogFailureHint(404, "application/json"), /endpoint/);
  assert.match(catalogFailureHint(500, "application/json"), /журнал API/);
  assert.match(catalogFailureHint(200, "text/html"), /HTML/);
});

test("keys are removed before log truncation, including echoed keys", () => {
  const key = `stebel_site_${"a".repeat(64)}`;
  const other = `stebel_site_${"b".repeat(64)}`;
  const result = safeCatalogDiagnostic("x".repeat(480) + key + other, key);
  assert.ok(result.length <= 500);
  assert.ok(!result.includes("stebel_site_"));
  assert.ok(!result.includes("aaaaaaaa"));
  assert.equal(safeCatalogDiagnostic(undefined, key), "");
});
