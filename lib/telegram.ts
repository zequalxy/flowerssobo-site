import type { PosifloraOrder } from "./posiflora";
import { contactMethodLabels, type OrderInput } from "./schema";
import { site } from "./site";

/** Escape characters that are special in Telegram HTML parse mode. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function row(label: string, value?: string): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  return `<b>${label}:</b> ${esc(v)}\n`;
}

/**
 * Уведомление о новом заказе. Основная заявка уходит в Posiflora — здесь
 * менеджер видит её содержимое и номер документа, чтобы сразу найти заказ.
 */
export function formatOrderMessage(
  data: OrderInput,
  order?: PosifloraOrder,
): string {
  const stamp = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  const methods = contactMethodLabels(data.contactMethods);

  const lines = [
    order
      ? "<b>НОВЫЙ ЗАКАЗ В POSIFLORA</b>\n"
      : "<b>НОВАЯ ЗАЯВКА С САЙТА</b>\n",
    // Номер документа — то, по чему заказ ищется в интерфейсе Posiflora.
    order ? row("Заказ", order.docNo ?? order.id) : "",
    row("ФИО", data.fullName),
    row("Телефон", data.phone),
    row("Telegram", data.telegramNick),
    row("Способ связи", methods),
    row("Что нужно", data.category),
    row("Комментарий", data.comment),
    // Фиксация факта согласия и версии документов (ч. 3 ст. 9 152-ФЗ):
    // вместе со штампом времени это доказательство, что согласие дано.
    `\n<i>Согласие на обработку ПДн подтверждено на сайте (редакция документов от ${esc(site.privacyRevision)})</i>`,
    `\n<i>${esc(stamp)} (МСК)</i>`,
  ];

  return lines.filter(Boolean).join("");
}

type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Раскрывает undici-шную «fetch failed» до реальной причины (ENOTFOUND,
 * ETIMEDOUT, ECONNREFUSED…) — иначе по логам не понять, DNS это или файрвол.
 */
function describeError(err: unknown): string {
  if (!(err instanceof Error)) return "Не удалось связаться с Telegram";
  const cause = err.cause as (Error & { code?: string }) | undefined;
  const causeText = cause ? ` (${cause.code ?? cause.message})` : "";
  return `${err.message}${causeText}`;
}

/** Send the order to Telegram via the Bot API. Token stays server-side. */
export async function sendOrderToTelegram(
  data: OrderInput,
  order?: PosifloraOrder,
): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdsRaw = process.env.TELEGRAM_CHAT_ID;
  // Если хостинг не выпускает трафик к api.telegram.org напрямую, сюда можно
  // подставить адрес своего прокси/зеркала Bot API (self-hosted telegram-bot-api
  // или простой reverse-proxy). Формат путей у зеркала должен совпадать.
  // Допустим и голый IP/хост без схемы — тогда подставляем http://.
  // ВНИМАНИЕ: по http токен идёт в открытом виде; для боевого прокси
  // настройте TLS и укажите https://.
  const rawBase = process.env.TELEGRAM_API_BASE ?? "https://api.telegram.org";
  const apiBase = (
    /^https?:\/\//i.test(rawBase) ? rawBase : `http://${rawBase}`
  ).replace(/\/+$/, "");

  if (!token || !chatIdsRaw) {
    return {
      ok: false,
      error:
        "Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в переменных окружения.",
    };
  }

  const chatIds = chatIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  const text = formatOrderMessage(data, order);

  // Ошибки URL/сети могут содержать полный адрес запроса вместе с токеном —
  // вычищаем его из всего, что уходит в логи.
  const redact = (s: string) => s.split(token).join("<TOKEN>");

  const sendOne = async (chatId: string): Promise<SendResult> => {
    try {
      const res = await fetch(
        `${apiBase}/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        const body = await res.text();
        return { ok: false, error: redact(`Telegram API ${res.status}: ${body}`) };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: redact(describeError(err)) };
    }
  };

  const results = await Promise.all(chatIds.map(sendOne));
  const failed = results.filter((r): r is { ok: false; error: string } => !r.ok);
  if (failed.length === results.length) {
    return { ok: false, error: failed.map((f) => f.error).join("; ") };
  }
  // Частичный сбой — заявка дошла не всем получателям; без лога владелец
  // «отвалившегося» чата никогда об этом не узнает.
  if (failed.length > 0) {
    console.error(
      `Telegram partial fail (${failed.length}/${results.length}):`,
      failed.map((f) => f.error).join("; "),
    );
  }
  return { ok: true };
}
