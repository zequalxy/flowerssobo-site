import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  CATALOG_REFRESH_MS,
  MAX_ITEM_QUANTITY,
  catalogLifetime,
  checkoutLines,
  parseStorefrontCatalog,
  storefrontImagePath,
} from "../lib/storefront.ts";
import {
  clearStorefrontRequest,
  definitiveStorefrontFailure,
  prepareStorefrontSubmission,
  storefrontRequestId,
} from "../lib/storefront-request.ts";

const flowerId = "00000000-0000-4000-8000-000000000001";
const bouquetId = "00000000-0000-4000-8000-000000000002";
const packagingId = "00000000-0000-4000-8000-000000000003";
const photoId = "00000000-0000-4000-8000-000000000004";

function item(overrides = {}) {
  return {
    id: flowerId, kind: "flower", name: "Роза", description: "Роза поштучно",
    priceKopecks: 25000, imageUrl: `/api/site/storefront/images/${flowerId}`,
    imageVersion: photoId, available: 20, composition: [], ...overrides,
  };
}
function catalog(items = [item()]) {
  return {
    items,
    generatedAt: "2026-11-06T12:00:00Z",
    validUntil: "2026-11-06T12:00:30Z",
  };
}
function mixedCatalog() {
  return parseStorefrontCatalog(catalog([
    item(),
    item({ id: bouquetId, kind: "bouquet", name: "Готовый букет", available: 1, priceKopecks: 299000 }),
    item({ id: packagingId, kind: "packaging", name: "Бумага", available: 4, priceKopecks: 15000 }),
  ]));
}

const storage = new Map();
Object.defineProperty(globalThis, "sessionStorage", {
  configurable: true,
  value: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  },
});
beforeEach(() => { clearStorefrontRequest(); storage.clear(); });

test("catalog projects public fields and versions the controlled image URL", () => {
  const result = parseStorefrontCatalog({
    ...catalog([item({ purchasePriceKopecks: 100, orgId: "private", supplier: "private" })]),
    secret: "private", valuation: { cost: 123 },
  });
  assert.equal(result.items[0].imageUrl, `/api/storefront/images/${flowerId}?v=${photoId}`);
  assert.equal(result.items[0].priceKopecks, 25000);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal("valuation" in result, false);
});

test("media projection rejects external URLs, traversal, queries and private endpoints", () => {
  assert.equal(storefrontImagePath(`/api/site/storefront/images/${flowerId}`), `/api/storefront/images/${flowerId}`);
  assert.equal(storefrontImagePath(""), "");
  for (const url of [
    "https://attacker.test/photo.jpg", "//attacker.test/photo.jpg",
    `/api/site/storefront/images/${flowerId}?url=https://attacker.test/`,
    `/api/site/storefront/images/../orders/${flowerId}`,
    `/api/orders/${flowerId}/photo`, `/api/site/storefront/images/${flowerId}/extra`,
  ]) assert.throws(() => storefrontImagePath(url), /Invalid storefront image/);
  assert.throws(() => parseStorefrontCatalog(catalog([item({ imageVersion: "../private" })])));
});

test("catalog rejects duplicate IDs and malformed quantities, money and freshness", () => {
  assert.throws(() => parseStorefrontCatalog(catalog([item(), item()])));
  for (const patch of [
    { available: -1 }, { available: 0.5 }, { priceKopecks: "25000" },
    { priceKopecks: -1 }, { priceKopecks: Number.MAX_SAFE_INTEGER + 1 },
    { kind: "internal" }, { id: "not-an-id" }, { expiresAt: "yesterday" },
    { composition: [{ productId: flowerId, name: "Роза", quantity: 0 }] },
  ]) assert.throws(() => parseStorefrontCatalog(catalog([item(patch)])));
  assert.throws(() => parseStorefrontCatalog({ ...catalog(), generatedAt: "invalid" }));
});

test("freshness lifetime is capped at 30 seconds and ends at the nearest expiry", () => {
  assert.equal(catalogLifetime(catalog()), CATALOG_REFRESH_MS);
  assert.equal(catalogLifetime({ ...catalog(), validUntil: "2026-11-06T12:00:05Z" }), 5000);
  assert.equal(catalogLifetime({ ...catalog(), validUntil: "2026-11-07T12:00:00Z" }), CATALOG_REFRESH_MS);
  assert.equal(catalogLifetime({ ...catalog(), validUntil: "2026-11-06T11:59:59Z" }), 0);
});

test("mixed selection quotes flowers, ready bouquet and packaging as distinct lines", () => {
  const result = checkoutLines([
    { id: flowerId, quantity: 5 }, { id: bouquetId, quantity: 1 }, { id: packagingId, quantity: 1 },
  ], mixedCatalog());
  assert.deepEqual(result, [
    { id: flowerId, quantity: 5, priceKopecks: 25000 },
    { id: bouquetId, quantity: 1, priceKopecks: 299000 },
    { id: packagingId, quantity: 1, priceKopecks: 15000 },
  ]);
  assert.equal(result.reduce((sum, line) => sum + line.priceKopecks * line.quantity, 0), 439000);
});

test("checkout blocks stale selection, overselling, duplicates, fractions and packaging-only", () => {
  const current = mixedCatalog();
  for (const lines of [
    [], [{ id: flowerId, quantity: 21 }], [{ id: bouquetId, quantity: 2 }],
    [{ id: flowerId, quantity: 0 }], [{ id: flowerId, quantity: 1.5 }],
    [{ id: flowerId, quantity: MAX_ITEM_QUANTITY + 1 }],
    [{ id: flowerId, quantity: 1 }, { id: flowerId, quantity: 1 }],
    [{ id: photoId, quantity: 1 }], [{ id: packagingId, quantity: 1 }],
  ]) assert.throws(() => checkoutLines(lines, current));
  assert.throws(() => checkoutLines([{ id: flowerId, quantity: 1 }], { ...current, items: [] }));
  for (const priceKopecks of [null, 0, 1_000_000_001]) {
    assert.throws(() => checkoutLines([{ id: flowerId, quantity: 1 }],
      parseStorefrontCatalog(catalog([item({ priceKopecks })]))));
  }
});

test("identical submission reuses its key without storing customer contact data", async () => {
  const payload = { customerName: "Тестовое имя", customerPhone: "+79001234567", items: [{ id: flowerId, quantity: 3, priceKopecks: 25000 }] };
  const first = await storefrontRequestId(payload);
  const repeated = await storefrontRequestId(structuredClone(payload));
  assert.equal(first, repeated);
  const stored = [...storage.values()].join("");
  assert.equal(stored.includes(payload.customerName), false);
  assert.equal(stored.includes(payload.customerPhone), false);
  const changed = await storefrontRequestId({ ...payload, items: [{ id: flowerId, quantity: 4, priceKopecks: 25000 }] });
  assert.notEqual(first, changed);
});

test("uncertain request freezes the original payload and UUID despite changed stock or prices", async () => {
  const payload = { fullName: "Тест", items: [{ id: flowerId, quantity: 3, priceKopecks: 25000 }] };
  const pending = await prepareStorefrontSubmission(payload, null);
  payload.items[0].quantity = 20;
  payload.items[0].priceKopecks = 40000;
  const changed = await prepareStorefrontSubmission({ fullName: "Другое имя", items: [] }, pending);
  assert.strictEqual(changed, pending);
  assert.equal(changed.requestId, pending.requestId);
  assert.deepEqual(changed.payload.items, [{ id: flowerId, quantity: 3, priceKopecks: 25000 }]);
  assert.equal(changed.payload.fullName, "Тест");
});

test("network/server failures retain pending request; definitive rejections release it", () => {
  for (const status of [0, 200, 408, 500, 502, 503, 504]) assert.equal(definitiveStorefrontFailure(status), false);
  for (const status of [400, 403, 409, 415, 422, 429]) assert.equal(definitiveStorefrontFailure(status), true);
});

test("successful resolution clears the key for a later independent request", async () => {
  const payload = { items: [{ id: flowerId, quantity: 3, priceKopecks: 25000 }] };
  const first = await storefrontRequestId(payload);
  clearStorefrontRequest();
  assert.notEqual(await storefrontRequestId(payload), first);
});
