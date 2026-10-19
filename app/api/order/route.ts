import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createPosifloraOrder, readPosifloraConfig } from "@/lib/posiflora";
import { orderSchema } from "@/lib/schema";
import {
  createStebelOrder,
  readStebelConfig,
  stebelConfigProblem,
  stebelOrderUrl,
  type StebelOrder,
  type StebelOutcome,
} from "@/lib/stebel";
import {
  isTelegramNotifyOnly,
  sendOrderToTelegram,
  type StoredOrder,
} from "@/lib/telegram";

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

/** Номер заказа в Стебле для Telegram: «№ 17», а без номера — его id. */
function stebelRef(order: StebelOrder): StoredOrder {
  return {
    system: "stebel",
    ref: order.number !== null ? `№ ${order.number}` : order.id,
    link: stebelOrderUrl(order) ?? undefined,
  };
}

/**
 * Сколько Telegram ждёт Стебель, чтобы положить в сообщение ссылку на заказ.
 * Обычно Стебель отвечает за доли секунды; если дольше — уведомление уходит
 * без ссылки, а не задерживает ответ покупателю.
 */
const STEBEL_LINK_WAIT_MS = 2_000;

/** Результат Стебля, если он успел за ms; иначе null. Сам запрос не обрывается. */
async function within(
  pending: Promise<StebelOutcome>,
  ms: number,
): Promise<StebelOutcome | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  try {
    return await Promise.race([pending, timeout]);
  } finally {
    clearTimeout(timer);
  }
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

  const success = () => NextResponse.json({ ok: true });

  // Комбинация, в которой заявку некуда положить: Telegram получает сигнал
  // без персональных данных, потому что детали «лежат в Posiflora или
  // Стебле», а ни то, ни другое не настроено. Раньше это молча теряло
  // заявку: клиент видел успех, владелец — содержательно пустое
  // уведомление, заказа не было нигде. Отказываемся до отправки: слать
  // бессмысленный сигнал незачем, а подменять его полной заявкой нельзя —
  // владелец сознательно отключил передачу персональных данных в Telegram,
  // и согласие на сайте может такой передачи не предусматривать.
  if (isTelegramNotifyOnly() && !readPosifloraConfig() && !readStebelConfig()) {
    const stebelProblem = stebelConfigProblem();
    console.error(
      "TELEGRAM_NOTIFY_ONLY=1, но ни Posiflora, ни Стебель не настроены: " +
        "заявку некуда сохранить. Задайте POSIFLORA_API_URL, " +
        "POSIFLORA_USERNAME, POSIFLORA_PASSWORD и POSIFLORA_STORE_ID или " +
        "STEBEL_API_URL и STEBEL_SITE_KEY — либо снимите " +
        "TELEGRAM_NOTIFY_ONLY, чтобы заявка уходила в Telegram целиком." +
        (stebelProblem ? ` Стебель: ${stebelProblem}` : ""),
    );
    return failure();
  }

  // Posiflora — основной адресат: пока заказ не заведён, заявки нет. При
  // сбое Стебель не зовём: клиент увидит ошибку и повторит заявку, а копия
  // в Стебле осталась бы заказом-призраком и потом задвоилась бы.
  const posiflora = await createPosifloraOrder(parsed.data);
  if (posiflora.status === "failed") {
    console.error("Posiflora order failed:", posiflora.error);
    return failure();
  }

  if (posiflora.status === "created") {
    const { order } = posiflora;
    const docNo = order.docNo ?? order.id;
    // Заказ уже в Posiflora. Telegram — уведомление, Стебель — копия для CRM
    // магазина; сбой любого из них клиенту не виден: заказ на месте, сбой
    // уходит в лог. Оба запроса идут почти параллельно: Telegram ждёт Стебель
    // не дольше STEBEL_LINK_WAIT_MS — последовательно они могли бы не
    // уложиться в 15 секунд, которые форма ждёт ответа сервера. id
    // заказа Posiflora — ключ идемпотентности для Стебля: повтор запроса не
    // создаст там второй заказ.
    const pending = createStebelOrder(parsed.data, {
      requestId: order.id,
      externalRef: `Посифлора ${docNo}`,
    });
    // Telegram ждёт Стебель недолго: успел — в сообщении ссылка на заказ в
    // Стебле (без персональных данных), нет — сообщение уходит без неё.
    const early = await within(pending, STEBEL_LINK_WAIT_MS);
    const link =
      early?.status === "created" ? stebelOrderUrl(early.order) : null;
    const [notified, stebel] = await Promise.all([
      sendOrderToTelegram(parsed.data, {
        system: "posiflora",
        ref: docNo,
        link: link ?? undefined,
      }),
      pending,
    ]);
    if (!notified.ok) {
      console.error("Telegram notification failed:", notified.error);
    }
    if (stebel.status === "failed") {
      console.error("Stebel order failed:", stebel.error);
    }
    return success();
  }

  // Posiflora не настроена — хранилищем становится Стебель, если он
  // подключён. Его зовём первым: номер заказа нужен для Telegram. Если
  // Стебель не подключён (status «disabled»), запрос к нему не уходит, и всё
  // как раньше: Telegram — единственный адресат.
  const stebel = await createStebelOrder(parsed.data, {
    requestId: randomUUID(),
  });
  if (stebel.status === "failed") {
    console.error("Stebel order failed:", stebel.error);
  }
  const stored =
    stebel.status === "created" ? stebelRef(stebel.order) : undefined;

  if (isTelegramNotifyOnly()) {
    // Заявка целиком есть только в Стебле (проверка выше гарантирует, что
    // он настроен). Не создан — заявки нет: сигнал «детали в Стебле» был бы
    // пустым, поэтому клиенту — ошибка. Создан — сбой сигнала только в лог.
    if (!stored) return failure();
    const notified = await sendOrderToTelegram(parsed.data, stored);
    if (!notified.ok) {
      console.error("Telegram notification failed:", notified.error);
    }
    return success();
  }

  // Заявка целиком уходит в Telegram — с номером заказа в Стебле, если он
  // создан. Принимаем, если заявка дошла хотя бы до одного из двух: ложный
  // отказ живому покупателю дороже, а заявка уже у магазина. Ошибка —
  // только когда она не дошла никуда.
  const notified = await sendOrderToTelegram(parsed.data, stored);
  if (!notified.ok) {
    console.error("Telegram notification failed:", notified.error);
    if (!stored) return failure();
  }
  return success();
}
