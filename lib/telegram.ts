import type { PosifloraOrder } from "./posiflora";
import { contactMethodLabels, type OrderInput } from "./schema";
import { site } from "./site";

type SendResult = { ok: true } | { ok: false; error: string };

/** Результат отправки одному получателю — с chat_id, чтобы лог назвал виновника. */
type ChatResult = { ok: true } | { ok: false; error: string; chatId: string };

/**
 * Режим «только уведомление»: заявка целиком уходит в Posiflora, а в Telegram —
 * лишь сигнал «пришла новая», без персональных данных клиента.
 *
 * ВКЛЮЧАТЬ ТОЛЬКО ТАМ, ГДЕ РАБОТАЕТ ИНТЕГРАЦИЯ С POSIFLORA
 * (TELEGRAM_NOTIFY_ONLY=1). По умолчанию в Telegram уходит заявка целиком:
 * иначе сборка без Posiflora молча теряла бы все заказы.
 */
export function isTelegramNotifyOnly(): boolean {
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

/**
 * Сигнал без персональных данных — для режима с Posiflora. Номер документа
 * персональными данными не является, зато по нему менеджер сразу находит
 * заказ, поэтому его добавляем.
 */
export function formatOrderNotification(order?: PosifloraOrder): string {
  const docNo = order?.docNo ?? order?.id;
  return [
    "<b>🌸 Новая заявка с сайта</b>",
    "",
    docNo ? `Заказ <b>${esc(docNo)}</b> — детали в Posiflora.` : "Детали — в Posiflora.",
    `<i>${esc(moscowStamp())} (МСК)</i>`,
  ].join("\n");
}

/**
 * Заявка целиком — режим по умолчанию, когда Posiflora не подключена либо
 * когда владелец хочет видеть контакты прямо в чате.
 */
export function formatOrderMessage(
  data: OrderInput,
  order?: PosifloraOrder,
): string {
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
  const text = isTelegramNotifyOnly()
    ? formatOrderNotification(order)
    : formatOrderMessage(data, order);

  // Ошибки URL/сети могут содержать полный адрес запроса вместе с токеном —
  // вычищаем его из всего, что уходит в логи.
  const redact = (s: string) => s.split(token).join("<TOKEN>");

  const sendOne = async (chatId: string): Promise<ChatResult> => {
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
        return {
          ok: false,
          chatId,
          error: redact(`Telegram API ${res.status}: ${body}`),
        };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, chatId, error: redact(describeError(err)) };
    }
  };

  const results = await Promise.all(chatIds.map(sendOne));
  const failed = results.filter(
    (r): r is { ok: false; error: string; chatId: string } => !r.ok,
  );
  // chat_id в сообщении обязателен: иначе при нескольких получателях
  // непонятно, какой из них отвалился, и виновника ищут перебором.
  const describeFailures = () =>
    failed.map((f) => `${f.chatId}: ${f.error}`).join("; ");

  if (failed.length === results.length) {
    return { ok: false, error: describeFailures() };
  }
  // Частичный сбой — уведомление дошло не всем получателям; без лога владелец
  // «отвалившегося» чата никогда об этом не узнает.
  if (failed.length > 0) {
    console.error(
      `Telegram partial fail (${failed.length}/${results.length}):`,
      describeFailures(),
    );
  }
  return { ok: true };
}
