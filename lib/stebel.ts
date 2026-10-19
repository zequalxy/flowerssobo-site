import { contactMethodLabels, type OrderInput } from "./schema";
import { site } from "./site";

/**
 * Клиент Стебля — CRM магазина. Каждая заявка с сайта становится в Стебле
 * новым заказом с источником «Сайт» (SiteOrderService.CreateSiteOrder).
 *
 * Протокол — Connect поверх обычного JSON: один POST, ключи в lowerCamelCase,
 * ошибка — JSON `{code, message}`. Запрос делает сервер сайта, браузер
 * покупателя Стебля не видит: ключ остаётся в env, CSP не меняется.
 */

/** Путь процедуры. База (STEBEL_API_URL) уже включает /api. */
const PROCEDURE = "/stebel.v1.SiteOrderService/CreateSiteOrder";

/** Как операция называется в логах. */
const WHERE = "CreateSiteOrder";

/**
 * Сервер Стебля требует этот заголовок у каждого Connect-запроса
 * (WithRequireConnectProtocolHeader): без него ответ — invalid_argument
 * «missing required header», и заказ не создаётся.
 */
const CONNECT_PROTOCOL_VERSION = "1";

/**
 * Ключ сайта идёт в своём заголовке, а не в Authorization: Caddy стенда
 * убирает Authorization, когда включён пароль стенда.
 */
const KEY_HEADER = "X-Stebel-Key";

/** Все ключи, которые выдаёт Стебель, начинаются так (Настройки → Сайт). */
const KEY_PREFIX = "stebel_site_";

/**
 * Время на одну попытку. Сам Стебель отвечает за доли секунды; восемь
 * секунд — запас на холодный старт и медленную сеть.
 */
const ATTEMPT_TIMEOUT_MS = 8_000;

/**
 * Общий бюджет на обе попытки. Пока Posiflora — хранилище заявки, Стебель
 * идёт параллельно с Telegram (10 с на запрос), а форма ждёт ответа сервера
 * 15 с. Копия в Стебле не должна задерживать ответ покупателю сильнее, чем
 * это уже может Telegram, поэтому повтор получает только остаток бюджета.
 */
const TOTAL_BUDGET_MS = 10_000;

/** Короче этого повтор не начинаем: он не успеет даже установить соединение. */
const MIN_RETRY_MS = 1_000;

/**
 * Пауза перед повтором. 503 обычно значит «API перезапускается» — повтор
 * в ту же миллисекунду получил бы тот же ответ.
 */
const RETRY_DELAY_MS = 500;

/**
 * Коды Connect, на которых повтор имеет смысл: сбой на стороне сервера или
 * сети. Повтор безопасен — с тем же requestId и тем же телом Стебель вернёт
 * уже созданный заказ (`replayed`), а не заведёт второй. На остальных кодах
 * (unauthenticated, invalid_argument, failed_precondition,
 * resource_exhausted…) ответ при повторе будет тем же.
 */
const RETRYABLE_CODES = new Set([
  "unavailable",
  "internal",
  "deadline_exceeded",
  "unknown",
]);

export type StebelConfig = {
  /** База API вместе с /api, без хвостового слэша. */
  baseUrl: string;
  key: string;
};

type StebelSetup =
  | { status: "ready"; config: StebelConfig }
  | { status: "unset" }
  | { status: "invalid"; error: string };

/** Пустая строка и пробелы — то же, что переменной нет. */
function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/**
 * Обычный http допустим только до своей машины (Стебель запущен рядом,
 * для проверки): по сети ключ ушёл бы открытым текстом.
 */
function isLoopback(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "[::1]" ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)
  );
}

/**
 * Разбирает env. Различаем «не настроено» (обе переменные пусты — штатный
 * режим, сайт работает без Стебля) и «настроено с ошибкой»: такую ошибку
 * нельзя молча считать выключенной интеграцией — заказы перестали бы
 * доходить до Стебля, и никто бы не узнал почему.
 */
function inspectStebelEnv(): StebelSetup {
  const rawUrl = env("STEBEL_API_URL");
  const key = env("STEBEL_SITE_KEY");
  if (!rawUrl && !key) return { status: "unset" };

  const invalid = (error: string): StebelSetup => ({ status: "invalid", error });
  if (!rawUrl) {
    return invalid(
      "STEBEL_SITE_KEY задан, а STEBEL_API_URL — нет: укажите адрес Стебля вместе с /api, например https://stebel.example.ru/api.",
    );
  }
  if (!key) {
    return invalid(
      "STEBEL_API_URL задан, а STEBEL_SITE_KEY — нет: создайте ключ в Стебле (Настройки → Сайт → «Создать ключ»).",
    );
  }
  // Сам ключ в сообщения не попадает ни целиком, ни частями.
  if (!key.startsWith(KEY_PREFIX)) {
    return invalid(
      `STEBEL_SITE_KEY не похож на ключ Стебля: он начинается с «${KEY_PREFIX}». ` +
        "Скопируйте ключ целиком, без кавычек и пробелов.",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return invalid(
      "STEBEL_API_URL не похож на адрес: нужен полный адрес со схемой, например https://stebel.example.ru/api.",
    );
  }
  // Пароль стенда в адресе не поможет: fetch отказывается от URL с логином,
  // а сам адрес с паролем окажется в логах.
  if (url.username || url.password) {
    return invalid(
      "STEBEL_API_URL не должен содержать логин и пароль: сайт входит в Стебель по ключу STEBEL_SITE_KEY.",
    );
  }
  if (url.search || url.hash) {
    return invalid(
      "STEBEL_API_URL должен быть базой API без «?» и «#», например https://stebel.example.ru/api.",
    );
  }
  const secure =
    url.protocol === "https:" ||
    (url.protocol === "http:" && isLoopback(url.hostname));
  if (!secure) {
    return invalid(
      "STEBEL_API_URL должен начинаться с https:// — по http ключ сайта ушёл бы открытым текстом. " +
        "http:// допустим только для localhost.",
    );
  }

  return {
    status: "ready",
    config: {
      baseUrl: `${url.origin}${url.pathname}`.replace(/\/+$/, ""),
      key,
    },
  };
}

/**
 * Конфиг только из env, как у Posiflora и Telegram. `null` — Стебель не
 * подключён (или подключён с ошибкой: её объясняет `stebelConfigProblem`,
 * а `createStebelOrder` вернёт её как `failed`).
 */
export function readStebelConfig(): StebelConfig | null {
  const setup = inspectStebelEnv();
  return setup.status === "ready" ? setup.config : null;
}

/** Что не так с переменными Стебля; `null` — всё в порядке или их нет вовсе. */
export function stebelConfigProblem(): string | null {
  const setup = inspectStebelEnv();
  return setup.status === "invalid" ? setup.error : null;
}

/**
 * Вычищает ключ из всего, что уходит в лог. Ключ длинный (76 символов),
 * но порог тот же, что в lib/posiflora.ts: замена коротких «секретов»
 * изрешетила бы сообщение, а не спрятала бы секрет.
 */
const MIN_SECRET_LENGTH = 8;

function redact(text: string, cfg: StebelConfig): string {
  if (cfg.key.length < MIN_SECRET_LENGTH) return text;
  return text.split(cfg.key).join("<REDACTED>");
}

/**
 * Разворачивает undici-шную «fetch failed» до реальной причины (ENOTFOUND,
 * ECONNREFUSED…) — тот же приём, что в lib/telegram.ts и lib/posiflora.ts.
 * Таймаут AbortSignal называем по-человечески: «This operation was aborted»
 * в логе не говорит, что сервер просто не ответил.
 */
function describeError(err: unknown, timeoutMs: number): string {
  if (err instanceof Error) {
    if (err.name === "TimeoutError") {
      const seconds = String(Math.round(timeoutMs / 100) / 10).replace(".", ",");
      return `нет ответа за ${seconds} с`;
    }
    const cause = err.cause as (Error & { code?: string }) | undefined;
    const causeText = cause ? ` (${cause.code ?? cause.message})` : "";
    return `${err.message}${causeText}`;
  }
  return String(err);
}

/** Тело похоже на HTML-страницу (веб-сервер, балансировщик), а не на ответ API. */
function looksLikeHtml(body: string): boolean {
  return /^\s*<(?:!doctype|html|head|body)/i.test(body);
}

type ConnectError = { code: string; message: string; fields: string[] };

/**
 * Ошибка Connect: `{"code":"invalid_argument","message":"Проверьте поля
 * формы.","details":[…]}`. Ошибки полей Стебель кладёт в details
 * (stebel.v1.FieldErrors); connect-go дублирует их читаемым JSON в `debug` —
 * берём оттуда, без разбора protobuf. Персональных данных в них нет:
 * это тексты вроде «Укажите телефон заказчика.»
 */
function parseConnectError(body: string): ConnectError | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { code, message, details } = parsed as Record<string, unknown>;
  if (typeof code !== "string" || !code) return null;

  const fields: string[] = [];
  if (Array.isArray(details)) {
    for (const detail of details) {
      const errors = (detail as { debug?: { errors?: unknown } } | null)?.debug
        ?.errors;
      if (!Array.isArray(errors)) continue;
      for (const e of errors) {
        const { field, message: text } = (e ?? {}) as Record<string, unknown>;
        if (typeof field === "string" && typeof text === "string") {
          fields.push(`${field}: ${text}`);
        }
      }
    }
  }
  return { code, message: typeof message === "string" ? message : "", fields };
}

/**
 * Подсказка на 404/405 без ответа Connect: запрос принял веб-сервер, а не
 * API. Почти всегда это STEBEL_API_URL без /api — Caddy Стебля тогда
 * отвечает «405 Method Not Allowed» за страницу приложения.
 */
const API_URL_HINT =
  " Проверьте STEBEL_API_URL: база должна заканчиваться на /api, например" +
  " https://stebel.example.ru/api (и сервер Стебля должен уметь принимать заявки с сайта).";

/** Ключ отклонил сам Стебель: его нет, он чужой или отозван. */
const KEY_HINT =
  " Проверьте STEBEL_SITE_KEY: действующие ключи — в Стебле, Настройки → Сайт.";

/**
 * 401 текстом, а не JSON Connect, — это пароль стенда в Caddy: до Стебля
 * запрос не дошёл, ключ тут ни при чём.
 */
const STAND_AUTH_HINT =
  " Запрос остановил пароль стенда (Caddy), а не Стебель: путь" +
  " /api/stebel.v1.SiteOrderService/ должен быть открыт без пароля — обновите Caddy Стебля.";

type Failure = { error: string; retryable: boolean };

function describeFailure(status: number, body: string): Failure {
  const connect = parseConnectError(body);
  if (connect) {
    const fields = connect.fields.length ? ` [${connect.fields.join("; ")}]` : "";
    const hint = connect.code === "unauthenticated" ? KEY_HINT : "";
    return {
      error: `Стебель ${status} (${connect.code}) на ${WHERE}: ${
        connect.message || "без описания"
      }${fields}${hint}`,
      retryable: RETRYABLE_CODES.has(connect.code),
    };
  }

  // Не Connect: ответил веб-сервер или прокси перед API. Caddy пишет статус
  // текстом («401 Unauthorized», «502 Bad Gateway»), сервер Стебля без базы —
  // «session lookup failed». HTML-страницу в лог не тащим: от неё только
  // килобайты разметки.
  const text = body.trim().slice(0, 300);
  const detail = looksLikeHtml(text)
    ? "вместо ответа API пришла HTML-страница."
    : !text
      ? "пустой ответ."
      : /[.!?]$/.test(text)
        ? text
        : `${text}.`;
  const hint =
    status === 404 || status === 405
      ? API_URL_HINT
      : status === 401
        ? STAND_AUTH_HINT
        : "";
  return {
    error: `Стебель ${status} на ${WHERE}: ${detail}${hint}`,
    // 5xx от прокси — Стебель перезапускается или недоступна база.
    // 501 — не временный сбой: такой процедуры на сервере нет.
    retryable: status >= 500 && status !== 501,
  };
}

/**
 * Адрес заказа в приложении Стебля — для ссылки в уведомлении. Приложение
 * живёт на том же адресе, что и API, без /api на конце. Не похоже на
 * адрес API — ссылки нет: лучше без неё, чем с битой.
 */
export function stebelOrderUrl(order: StebelOrder): string | null {
  const cfg = readStebelConfig();
  if (!cfg || !/\/api$/.test(cfg.baseUrl)) return null;
  return `${cfg.baseUrl.replace(/\/api$/, "")}/orders/${encodeURIComponent(order.id)}`;
}

/** Что вернул Стебель после создания заказа. */
export type StebelOrder = {
  id: string;
  /** Номер заказа внутри магазина: «№ 17». */
  number: number | null;
  /** true — заказ с этим requestId уже был создан раньше (повтор). */
  replayed: boolean;
};

/**
 * `disabled` — Стебель не подключён (env пусты): это штатный режим.
 * `failed` — заказ в Стебле не создан; error уже без ключа.
 */
export type StebelOutcome =
  | { status: "created"; order: StebelOrder }
  | { status: "disabled" }
  | { status: "failed"; error: string };

/**
 * Ответ `{"orderId":"…","number":17,"replayed":true}`. protojson не пишет
 * нулевые значения, поэтому отсутствующий `replayed` — это false.
 * Без orderId ответ не считаем успехом: Connect при успехе всегда его
 * присылает, а 200 без него — страница прокси, а не заказ.
 */
function parseOrder(body: string): StebelOrder | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const { orderId, number, replayed } = parsed as Record<string, unknown>;
  if (typeof orderId !== "string" || !orderId) return null;

  let num: number | null = null;
  if (typeof number === "number" && Number.isInteger(number) && number > 0) {
    num = number;
  } else if (typeof number === "string" && /^[1-9]\d*$/.test(number)) {
    num = Number(number);
  }
  return { id: orderId, number: num, replayed: replayed === true };
}

/**
 * Способы связи с ником, приклеенным к Телеграму: «Телеграм @anna, WhatsApp».
 * Ник без отмеченного Телеграма не теряем: «WhatsApp, Telegram: @anna».
 * Голому нику добавляем «@», чтобы флорист сразу видел, что это ник.
 */
function contactPreference(data: OrderInput): string {
  const raw = data.telegramNick?.trim() ?? "";
  const nick = /^[A-Za-z0-9_]+$/.test(raw) ? `@${raw}` : raw;
  const methods = Array.from(new Set(data.contactMethods));

  const parts = methods.map((id) => {
    const label = contactMethodLabels([id]);
    return id === "telegram" && nick ? `${label} ${nick}` : label;
  });
  if (nick && !methods.includes("telegram")) parts.push(`Telegram: ${nick}`);
  return parts.join(", ");
}

type StebelRequestOptions = {
  /**
   * Ключ идемпотентности: повтор с тем же requestId и тем же телом вернёт уже
   * созданный заказ. Поэтому тело собирается один раз и уходит в повтор
   * байт в байт: другое содержимое под тем же номером Стебель отклонит.
   */
  requestId: string;
  /** Номер этой же заявки в другой системе: «Посифлора site53da7243». */
  externalRef?: string;
};

/**
 * Тело CreateSiteOrderRequest. Длины формы (lib/schema.ts) укладываются в
 * пределы Стебля с запасом: имя 80 из 100, что нужно 60 из 200, комментарий
 * 1000 из 1500. IP покупателя не передаём — Стеблю он не нужен, а лишние
 * персональные данные — лишний риск.
 */
function buildRequest(data: OrderInput, opts: StebelRequestOptions) {
  return {
    requestId: opts.requestId,
    customerName: data.fullName,
    customerPhone: data.phone,
    wish: data.category?.trim() ?? "",
    comment: data.comment?.trim() ?? "",
    contactPreference: contactPreference(data),
    ...(opts.externalRef ? { externalRef: opts.externalRef } : {}),
    // След согласия, как в Posiflora и Telegram (ч. 3 ст. 9 152-ФЗ). Время
    // заявки Стебель допишет сам; здесь его нет намеренно — иначе повтор
    // отличался бы от первой попытки, и Стебель счёл бы его другой заявкой.
    consent: `на сайте ${site.domain}, редакция документов от ${site.privacyRevision}`,
  };
}

type Attempt = { ok: true; order: StebelOrder } | ({ ok: false } & Failure);

async function attempt(
  cfg: StebelConfig,
  body: string,
  timeoutMs: number,
): Promise<Attempt> {
  let res: Response;
  let text: string;
  try {
    res = await fetch(`${cfg.baseUrl}${PROCEDURE}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Connect-Protocol-Version": CONNECT_PROTOCOL_VERSION,
        [KEY_HEADER]: cfg.key,
      },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    // Тело читаем под тем же таймаутом: обрыв посреди ответа — тоже сетевой сбой.
    text = await res.text();
  } catch (err) {
    return {
      ok: false,
      // Сетевой сбой undici — TypeError «fetch failed» с причиной в cause.
      // TypeError без cause значит, что запрос даже не собрался (например,
      // в ключе кириллица и заголовок недопустим): повтор не поможет.
      retryable: !(err instanceof TypeError && err.cause === undefined),
      error: `${WHERE}: ${describeError(err, timeoutMs)}`,
    };
  }

  if (!res.ok) return { ok: false, ...describeFailure(res.status, text) };

  const order = parseOrder(text);
  if (!order) {
    const hint = looksLikeHtml(text) ? API_URL_HINT : "";
    return {
      ok: false,
      retryable: false,
      error: `Стебель ${res.status} на ${WHERE}: в ответе нет orderId — ответил не API Стебля.${hint}`,
    };
  }
  return { ok: true, order };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Создаёт заказ в Стебле. Никогда не бросает: вызывающий код решает по
 * `status`, важен ли сбой. Сетевой сбой, таймаут и 5xx повторяются один раз
 * с тем же requestId — если первая попытка всё-таки дошла, Стебель вернёт
 * тот же заказ, а не заведёт второй.
 */
export async function createStebelOrder(
  data: OrderInput,
  opts: StebelRequestOptions,
): Promise<StebelOutcome> {
  const setup = inspectStebelEnv();
  if (setup.status === "unset") return { status: "disabled" };
  if (setup.status === "invalid") return { status: "failed", error: setup.error };
  const cfg = setup.config;

  try {
    const body = JSON.stringify(buildRequest(data, opts));
    const deadline = Date.now() + TOTAL_BUDGET_MS;

    const first = await attempt(cfg, body, ATTEMPT_TIMEOUT_MS);
    if (first.ok) return { status: "created", order: first.order };
    if (!first.retryable) {
      return { status: "failed", error: redact(first.error, cfg) };
    }

    const left = deadline - Date.now() - RETRY_DELAY_MS;
    if (left < MIN_RETRY_MS) {
      return {
        status: "failed",
        error: redact(`${first.error}; на повтор не осталось времени`, cfg),
      };
    }
    // Повтор в лог: частые повторы — повод посмотреть на сеть или сервер Стебля.
    console.warn("Stebel retry with the same requestId:", redact(first.error, cfg));
    await sleep(RETRY_DELAY_MS);

    const second = await attempt(cfg, body, Math.min(ATTEMPT_TIMEOUT_MS, left));
    if (second.ok) return { status: "created", order: second.order };
    return {
      status: "failed",
      error: redact(`${first.error}; повтор: ${second.error}`, cfg),
    };
  } catch (err) {
    // Сюда попадать нечему, но обещание «никогда не бросает» держим.
    return {
      status: "failed",
      error: redact(`${WHERE}: ${describeError(err, ATTEMPT_TIMEOUT_MS)}`, cfg),
    };
  }
}
