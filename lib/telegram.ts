import type { OrderInput } from "./schema";
import { site } from "./site";

type SendResult = { ok: true } | { ok: false; error: string };

/**
 * Режим «только уведомление»: заявка целиком уходит в Posiflora, а в Telegram —
 * лишь сигнал «пришла новая», без персональных данных клиента.
 *
 * ВКЛЮЧАЕТСЯ ТОЛЬКО ТАМ, ГДЕ ЕСТЬ ИНТЕГРАЦИЯ С POSIFLORA (TELEGRAM_NOTIFY_ONLY=1).
 * В этом репозитории её нет, поэтому по умолчанию в Telegram уходит заявка
 * целиком: иначе сборка без Posiflora молча теряла бы все заказы.
 */
function notifyOnly(): boolean {
  return process.env.TELEGRAM_NOTIFY_ONLY === "1";
}

function moscowStamp(): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

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

const METHOD_LABELS: Record<string, string> = {
  telegram: "Телеграм",
  whatsapp: "WhatsApp",
  phone: "Телефон",
};

/** Сигнал без персональных данных — для режима с Posiflora. */
export function formatOrderNotification(): string {
  return [
    "<b>🌸 Новая заявка с сайта</b>",
    "",
    "Детали — в Posiflora.",
    `<i>${moscowStamp()} (МСК)</i>`,
  ].join("\n");
}

/** Заявка целиком — режим по умолчанию, когда Posiflora не подключена. */
export function formatOrderMessage(data: OrderInput): string {
  const methods = (data.contactMethods ?? [])
    .map((m) => METHOD_LABELS[m] ?? m)
    .join(", ");

  const lines = [
    "<b>НОВАЯ ЗАЯВКА С САЙТА</b>\n",
    row("ФИО", data.fullName),
    row("Телефон", data.phone),
    row("Telegram", data.telegramNick),
    row("Способ связи", methods),
    row("Что нужно", data.category),
    row("Комментарий", data.comment),
    // Фиксация факта согласия и версии документов (ч. 3 ст. 9 152-ФЗ):
    // вместе со штампом времени это доказательство, что согласие дано.
    `\n<i>Согласие на обработку ПДн подтверждено на сайте (редакция документов от ${esc(site.privacyRevision)})</i>`,
    `\n<i>${esc(moscowStamp())} (МСК)</i>`,
  ];

  return lines.filter(Boolean).join("");
}

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

/**
 * Отправить заявку в Telegram владельца: целиком или, в режиме с Posiflora,
 * только уведомление (см. notifyOnly). Токен остаётся на сервере.
 */
export async function sendOrderToTelegram(data: OrderInput): Promise<SendResult> {
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
  const text = notifyOnly()
    ? formatOrderNotification()
    : formatOrderMessage(data);

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
  // Частичный сбой — уведомление дошло не всем получателям; без лога владелец
  // «отвалившегося» чата никогда об этом не узнает.
  if (failed.length > 0) {
    console.error(
      `Telegram partial fail (${failed.length}/${results.length}):`,
      failed.map((f) => f.error).join("; "),
    );
  }
  return { ok: true };
}
