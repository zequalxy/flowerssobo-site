import "server-only";
import { readStebelConfig, stebelConfigProblem, type StebelOrder } from "./stebel";
import { contactMethodLabels, type OrderInput } from "./schema";
import { site } from "./site";
import { parseStorefrontCatalog, type CheckoutLine, type StorefrontCatalog } from "./storefront";
import { catalogFailureHint, safeCatalogDiagnostic } from "./storefront-diagnostics";

export class StorefrontError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function storefrontConfig() {
  const config = readStebelConfig();
  if (!config) {
    console.error("Stebel storefront configuration failed", {
      reason: stebelConfigProblem() ?? "STEBEL_API_URL и STEBEL_SITE_KEY не заданы на сервере сайта.",
    });
    throw new StorefrontError(503, "Витрина временно недоступна. Напишите нам — поможем с выбором.");
  }
  return config;
}

/** One timeout covers headers and body, and redirects never receive the site key. */
async function readJSON(response: Response): Promise<unknown> {
  const text = await readCapped(response, 2_000_000);
  try { return JSON.parse(new TextDecoder().decode(text)); }
  catch { throw new StorefrontError(502, "Не удалось обновить витрину. Попробуйте ещё раз."); }
}

export async function readCapped(response: Response, limit: number): Promise<Uint8Array> {
  if (Number(response.headers.get("content-length") ?? 0) > limit || !response.body) {
    throw new StorefrontError(502, "Некорректный ответ витрины.");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new StorefrontError(502, "Слишком большой ответ витрины."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}

export async function getStorefrontCatalog(): Promise<StorefrontCatalog> {
  const cfg = storefrontConfig();
  const endpoint = `${cfg.baseUrl}/site/catalog`;
  let response: Response | undefined;
  let stage = "network";
  try {
    response = await fetch(endpoint, {
      headers: { "X-Stebel-Key": cfg.key }, cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(7000),
    });
    stage = "http";
    const contentType = response.headers.get("content-type") ?? "";
    if (!response.ok) {
      // Never log arbitrary response bodies: a reverse proxy may return private HTML.
      await response.body?.cancel();
      throw new Error(catalogFailureHint(response.status, contentType));
    }
    stage = "response";
    if (!contentType.includes("json")) {
      await response.body?.cancel();
      throw new Error(catalogFailureHint(response.status, contentType));
    }
    const value = await readJSON(response);
    stage = "schema";
    return parseStorefrontCatalog(value);
  } catch (error) {
    const cause = error instanceof Error ? error.cause as { code?: unknown } | undefined : undefined;
    console.error("Stebel storefront catalog failed", {
      stage, endpoint: safeCatalogDiagnostic(endpoint, cfg.key),
      status: response?.status ?? null,
      contentType: response?.headers.get("content-type") ?? null,
      error: safeCatalogDiagnostic(error instanceof Error ? error.message : "Unknown catalog error", cfg.key),
      cause: safeCatalogDiagnostic(cause?.code, cfg.key),
    });
    throw new StorefrontError(503, "Наличие сейчас уточняется. Попробуйте обновить витрину или напишите флористу.");
  }
}

export async function createStorefrontOrder(data: OrderInput, requestId: string, items: CheckoutLine[]): Promise<StebelOrder> {
  const cfg = storefrontConfig();
  const body = JSON.stringify({
    requestId, items, customerName: data.fullName, customerPhone: data.phone,
    wish: "Выбор из витрины", comment: data.comment?.trim() ?? "",
    contactPreference: [contactMethodLabels(data.contactMethods), data.telegramNick?.trim()].filter(Boolean).join(" "),
    consent: `на сайте ${site.domain}, редакция документов от ${site.privacyRevision}`,
  });
  // Both attempts use the exact same ID and body. No Telegram-only success here.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${cfg.baseUrl}/site/orders`, {
        method: "POST", headers: { "Content-Type": "application/json", "X-Stebel-Key": cfg.key },
        body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(4500),
      });
      if (!response.ok) {
        if (response.status >= 500 && attempt === 0) { await response.body?.cancel(); continue; }
        if ([400, 409, 422, 429].includes(response.status)) {
          const value = await readJSON(response) as { message?: unknown; error?: unknown };
          const raw = value.message ?? value.error;
          const message = typeof raw === "string" && raw.length <= 600
            ? raw.split(cfg.key).join("[ключ скрыт]")
            : "Наличие или цена изменились. Проверьте выбранные позиции.";
          throw new StorefrontError(response.status, message);
        }
        throw new StorefrontError(502, "Не удалось сохранить заявку. Повторите отправку — дубликат не появится.");
      }
      const value = await readJSON(response) as { orderId?: unknown; number?: unknown; replayed?: unknown };
      if (typeof value.orderId !== "string" || !value.orderId) throw new Error("Missing order ID");
      return { id: value.orderId, number: typeof value.number === "number" ? value.number : null, replayed: value.replayed === true };
    } catch (error) {
      if (error instanceof StorefrontError) throw error;
      if (attempt === 1) throw new StorefrontError(502, "Ответ магазина не получен. Повторите отправку — дубликат не появится.");
    }
  }
  throw new StorefrontError(502, "Не удалось отправить заявку.");
}
