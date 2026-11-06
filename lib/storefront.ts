/** Public storefront data only. Prices are integer kopecks throughout checkout. */
export type StorefrontKind = "flower" | "packaging" | "bouquet";

export type StorefrontItem = {
  id: string;
  kind: StorefrontKind;
  name: string;
  description: string;
  priceKopecks: number | null;
  imageUrl: string;
  available: number;
  composition: { productId: string; name: string; quantity: number }[];
  expiresAt?: string;
};

export type StorefrontCatalog = {
  items: StorefrontItem[];
  generatedAt: string;
  validUntil: string;
};

export type CartLine = { id: string; quantity: number };
export type CheckoutLine = CartLine & { priceKopecks: number };

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_CART_LINES = 50;
export const MAX_ITEM_QUANTITY = 1000;
export const CATALOG_REFRESH_MS = 30_000;

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid storefront response");
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, min = 0): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min;
}

/** Only this upstream path can become a public image; arbitrary URLs are rejected. */
export function storefrontImagePath(value: unknown): string {
  if (value === "" || value == null) return "";
  if (typeof value !== "string") throw new Error("Invalid storefront image");
  const prefix = "/api/site/storefront/images/";
  if (!value.startsWith(prefix) || !UUID.test(value.slice(prefix.length))) {
    throw new Error("Invalid storefront image");
  }
  return `/api/storefront/images/${value.slice(prefix.length)}`;
}

/** Parse a deliberately small projection; never forward arbitrary upstream fields. */
export function parseStorefrontCatalog(value: unknown): StorefrontCatalog {
  const data = record(value);
  if (!Array.isArray(data.items) || data.items.length > 5000) {
    throw new Error("Invalid storefront items");
  }
  if (typeof data.generatedAt !== "string" || !Number.isFinite(Date.parse(data.generatedAt)) ||
      typeof data.validUntil !== "string" || !Number.isFinite(Date.parse(data.validUntil))) {
    throw new Error("Invalid storefront lifetime");
  }
  const seen = new Set<string>();
  const items = data.items.map((raw): StorefrontItem => {
    const item = record(raw);
    if (typeof item.id !== "string" || !UUID.test(item.id) || seen.has(item.id) ||
        !["flower", "packaging", "bouquet"].includes(String(item.kind)) ||
        typeof item.name !== "string" || !item.name.trim() || item.name.length > 300 ||
        typeof item.description !== "string" || item.description.length > 5000 ||
        !integer(item.available) ||
        (item.priceKopecks !== null && !integer(item.priceKopecks))) {
      throw new Error("Invalid storefront item");
    }
    seen.add(item.id);
    const composition = Array.isArray(item.composition) ? item.composition.map((rawPart) => {
      const part = record(rawPart);
      if (typeof part.productId !== "string" || !UUID.test(part.productId) ||
          typeof part.name !== "string" || !integer(part.quantity, 1)) {
        throw new Error("Invalid bouquet composition");
      }
      return { productId: part.productId, name: part.name, quantity: part.quantity };
    }) : [];
    if (item.expiresAt != null && (typeof item.expiresAt !== "string" || !Number.isFinite(Date.parse(item.expiresAt)))) {
      throw new Error("Invalid storefront expiry");
    }
    if (item.imageVersion != null && item.imageVersion !== "" &&
        (typeof item.imageVersion !== "string" || !UUID.test(item.imageVersion))) {
      throw new Error("Invalid storefront image version");
    }
    const imagePath = storefrontImagePath(item.imageUrl);
    return {
      id: item.id,
      kind: item.kind as StorefrontKind,
      name: item.name,
      description: item.description,
      priceKopecks: item.priceKopecks as number | null,
      imageUrl: imagePath && item.imageVersion ? `${imagePath}?v=${item.imageVersion}` : imagePath,
      available: item.available,
      composition,
      ...(typeof item.expiresAt === "string" ? { expiresAt: item.expiresAt } : {}),
    };
  });
  return { items, generatedAt: data.generatedAt, validUntil: data.validUntil };
}

export function formatKopecks(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency", currency: "RUB", maximumFractionDigits: value % 100 === 0 ? 0 : 2,
  }).format(value / 100);
}

/** Both client and request boundary reject duplicates, fractions and unsafe totals. */
export function checkoutLines(cart: CartLine[], catalog: StorefrontCatalog): CheckoutLine[] {
  if (cart.length === 0 || cart.length > MAX_CART_LINES) throw new Error("Выберите цветы или готовый букет.");
  const seen = new Set<string>();
  const result = cart.map((line) => {
    const item = catalog.items.find((candidate) => candidate.id === line.id);
    if (!item || seen.has(line.id) || !integer(line.quantity, 1) || line.quantity > MAX_ITEM_QUANTITY ||
        item.available < line.quantity || item.priceKopecks === null || item.priceKopecks < 1 || item.priceKopecks > 1_000_000_000) {
      throw new Error("Наличие изменилось. Проверьте выбранные цветы и букеты.");
    }
    seen.add(line.id);
    return { id: line.id, quantity: line.quantity, priceKopecks: item.priceKopecks };
  });
  if (!Number.isSafeInteger(result.reduce((sum, line) => sum + line.priceKopecks * line.quantity, 0))) {
    throw new Error("Слишком большая сумма заявки.");
  }
  if (!cart.some((line) => catalog.items.find((item) => item.id === line.id)?.kind !== "packaging")) {
    throw new Error("Добавьте цветы или готовый букет к упаковке.");
  }
  return result;
}

/** The browser uses a relative lifetime to avoid depending on its wall clock. */
export function catalogLifetime(catalog: StorefrontCatalog): number {
  return Math.max(0, Math.min(CATALOG_REFRESH_MS, Date.parse(catalog.validUntil) - Date.parse(catalog.generatedAt)));
}
