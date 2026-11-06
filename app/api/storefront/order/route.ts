import { after } from "next/server";
import { z } from "zod";
import { orderSchema } from "@/lib/schema";
import { createStorefrontOrder, StorefrontError } from "@/lib/storefront-server";
import { MAX_CART_LINES, MAX_ITEM_QUANTITY } from "@/lib/storefront";
import { stebelOrderUrl } from "@/lib/stebel";
import { sendOrderToTelegram } from "@/lib/telegram";

export const runtime = "nodejs";

const schema = orderSchema.extend({
  requestId: z.string().uuid(),
  items: z.array(z.object({
    id: z.string().uuid(),
    quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
    priceKopecks: z.number().int().min(1).max(1_000_000_000),
  })).min(1).max(MAX_CART_LINES).refine((items) => new Set(items.map((item) => item.id)).size === items.length),
});

const attempts = new Map<string, { until: number; ids: Set<string> }>();
function limited(ip: string, id: string): boolean {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const value = attempts.get(ip) ?? { until: now + 10 * 60_000, ids: new Set<string>() };
  // Retrying one request does not consume another slot or prevent recovery after a timeout.
  if (!value.ids.has(id) && (value.ids.size >= 5 || attempts.size >= 10_000)) return true;
  value.ids.add(id);
  attempts.set(ip, value);
  return false;
}

async function body(req: Request): Promise<unknown> {
  const limit = 20_000;
  if (Number(req.headers.get("content-length") ?? 0) > limit || !req.body) throw new StorefrontError(413, "Слишком большой запрос.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > limit) { await reader.cancel(); throw new StorefrontError(413, "Слишком большой запрос."); }
    chunks.push(part.value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new StorefrontError(400, "Проверьте поля заявки."); }
}

export async function POST(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  const origin = req.headers.get("origin");
  if ((origin && origin !== new URL(req.url).origin) || req.headers.get("sec-fetch-site") === "cross-site") {
    return Response.json({ ok: false, error: "Отправьте заявку со страницы магазина." }, { status: 403, headers });
  }
  if (req.headers.get("content-type")?.split(";")[0] !== "application/json") {
    return Response.json({ ok: false, error: "Некорректный запрос." }, { status: 415, headers });
  }
  try {
    const parsed = schema.safeParse(await body(req));
    if (!parsed.success) throw new StorefrontError(422, "Проверьте поля заявки и выбранные позиции.");
    if (parsed.data.extraField) return Response.json({ ok: true }, { headers });
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (limited(ip, parsed.data.requestId)) throw new StorefrontError(429, "Слишком много заявок. Подождите немного или позвоните нам.");
    const order = await createStorefrontOrder(parsed.data, parsed.data.requestId, parsed.data.items);
    // A structured order must already exist in Stebel before the customer sees success.
    // The legacy Posiflora/Telegram-only route cannot provide this guarantee.
    if (!order.replayed && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      after(async () => {
        const notification = await sendOrderToTelegram(parsed.data, {
          system: "stebel", ref: order.number === null ? order.id : `№ ${order.number}`,
          link: stebelOrderUrl(order) ?? undefined,
        });
        if (!notification.ok) console.error("Storefront Telegram notification failed:", notification.error);
      });
    }
    return Response.json({ ok: true, number: order.number, replayed: order.replayed }, { headers });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof StorefrontError ? error.message : "Не удалось отправить заявку. Повторите попытку." },
      { status: error instanceof StorefrontError ? error.status : 502, headers });
  }
}
