import { NextResponse } from "next/server";
import { createPosifloraOrder } from "@/lib/posiflora";
import { orderSchema } from "@/lib/schema";
import { sendOrderToTelegram } from "@/lib/telegram";

export const runtime = "nodejs";

// Лёгкий rate-limit: не больше 5 заявок с одного IP за 10 минут. Карта живёт
// в памяти инстанса — на serverless это best-effort защита от спам-волны
// в Telegram владельца, а не строгая гарантия (ботов попроще ловит honeypot).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 1000) {
    for (const [key, stamps] of hits) {
      if (stamps.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return false;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Слишком много заявок подряд. Подождите немного или позвоните нам.",
      },
      { status: 429 },
    );
  }

  // Форма шлёт сотни байт; всё сильно больше — не наша форма.
  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (contentLength > 10_000) {
    return NextResponse.json(
      { ok: false, error: "Некорректный запрос" },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Некорректный запрос" },
      { status: 400 },
    );
  }

  const parsed = orderSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Проверьте поля формы" },
      { status: 422 },
    );
  }

  // Honeypot tripped — silently accept and drop. Логируем: всплеск может
  // означать, что автозаполнение браузеров ловит реальных клиентов.
  if (parsed.data.extraField) {
    console.warn("Order honeypot tripped");
    return NextResponse.json({ ok: true });
  }

  // Фабрика, а не готовый Response: тело можно прочитать только один раз.
  const failure = () =>
    NextResponse.json(
      {
        ok: false,
        error:
          "Не удалось отправить заявку. Позвоните нам или напишите в мессенджер.",
      },
      { status: 502 },
    );

  // Posiflora — основной адресат: пока заказ не заведён, заявки нет.
  const posiflora = await createPosifloraOrder(parsed.data);
  if (posiflora.status === "failed") {
    console.error("Posiflora order failed:", posiflora.error);
    return failure();
  }

  const order = posiflora.status === "created" ? posiflora.order : undefined;

  // Telegram — уведомление о заказе. Заказ уже в Posiflora, поэтому сбой
  // рассылки не должен выглядеть для клиента как потерянная заявка: логируем
  // и отвечаем успехом. Исключение — когда Posiflora не настроена: тогда
  // Telegram остаётся единственным адресатом и его сбой означает потерю заявки.
  const notified = await sendOrderToTelegram(parsed.data, order);
  if (!notified.ok) {
    console.error("Telegram notification failed:", notified.error);
    if (posiflora.status === "disabled") return failure();
  }

  return NextResponse.json({ ok: true });
}
