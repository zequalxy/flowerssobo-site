import { NextResponse } from "next/server";
import { createPosifloraOrder, readPosifloraConfig } from "@/lib/posiflora";
import { orderSchema } from "@/lib/schema";
import { isTelegramNotifyOnly, sendOrderToTelegram } from "@/lib/telegram";

export const runtime = "nodejs";

// Лёгкий rate-limit: не больше 5 заявок с одного IP за 10 минут. Карта живёт
// в памяти процесса: в Docker-контейнере это честный лимит, при нескольких
// репликах — best-effort (ботов попроще ловит honeypot).
// IP берём из первого значения X-Forwarded-For: его можно подделать, зато
// лимит никогда не склеит разных клиентов в одну корзину за общим прокси —
// ложный отказ живому покупателю дороже пропущенного спама.
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

const MAX_BODY_BYTES = 10_000;

/** Тело запроса строкой, или null — если оно длиннее лимита. */
async function readBodyCapped(req: Request, limit: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > limit) return null;
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
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

  // Форма шлёт сотни байт; всё сильно больше — не наша форма. Заголовку
  // Content-Length верить нельзя (при chunked его просто нет), поэтому тело
  // читаем сами и обрываем, как только перевалили за лимит.
  const body = await readBodyCapped(req, MAX_BODY_BYTES);
  if (body === null) {
    return NextResponse.json(
      { ok: false, error: "Некорректный запрос" },
      { status: 413 },
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body);
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

  // Комбинация, в которой заявку некуда положить: Telegram получает сигнал
  // без персональных данных, потому что детали «лежат в Posiflora», а
  // Posiflora не настроена. Раньше это молча теряло заявку: клиент видел
  // успех, владелец — содержательно пустое уведомление, заказа не было
  // нигде. Отказываемся до отправки: слать бессмысленный сигнал незачем, а
  // подменять его полной заявкой нельзя — владелец сознательно отключил
  // передачу персональных данных в Telegram, и согласие на сайте может
  // такой передачи не предусматривать.
  if (isTelegramNotifyOnly() && !readPosifloraConfig()) {
    console.error(
      "TELEGRAM_NOTIFY_ONLY=1, но Posiflora не настроена: заявку некуда " +
        "сохранить. Задайте POSIFLORA_API_URL, POSIFLORA_USERNAME, " +
        "POSIFLORA_PASSWORD и POSIFLORA_STORE_ID — либо снимите " +
        "TELEGRAM_NOTIFY_ONLY, чтобы заявка уходила в Telegram целиком.",
    );
    return failure();
  }

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
