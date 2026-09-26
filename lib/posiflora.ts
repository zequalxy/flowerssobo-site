import { randomUUID } from "node:crypto";

import { contactMethodLabels, type OrderInput } from "./schema";
import { site } from "./site";

/**
 * Клиент Posiflora API (JSON:API).
 *
 * Слой сессии (логин по паре username/password, кэш access-токена и его
 * продление по refresh-токену) плюс создание заказа — `createPosifloraOrder`.
 */

/** Posiflora отвечает 415, если прислать обычный application/json. */
const JSON_API = "application/vnd.api+json";

/**
 * Считаем токен протухшим за полминуты до реального `expireAt`: между проверкой
 * и уходом запроса проходит время, и на границе мы бы ловили 401 на ровном месте.
 */
const EXPIRY_SKEW_MS = 30_000;

const REQUEST_TIMEOUT_MS = 10_000;

type PosifloraConfig = {
  baseUrl: string;
  username: string;
  password: string;
};

/**
 * Конфиг только из env — как и токен Telegram, креды никогда не лежат в коде.
 * `null` означает «интеграция не настроена», и это не ошибка: сайт должен
 * подниматься и без Posiflora.
 */
export function readPosifloraConfig(): PosifloraConfig | null {
  const baseUrl = process.env.POSIFLORA_API_URL;
  const username = process.env.POSIFLORA_USERNAME;
  const password = process.env.POSIFLORA_PASSWORD;
  if (!baseUrl || !username || !password) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    username,
    password,
  };
}

type CachedSession = {
  accessToken: string;
  expireAt: number;
  refreshToken: string;
  refreshExpireAt: number;
  /** Сотрудник из ответа логина — становится `createdBy` у заказа. */
  workerId: string | null;
};

/**
 * Кэш живёт в памяти инстанса. На serverless это best-effort (у каждого
 * холодного инстанса свой), но в пределах одного инстанса убирает лишний
 * логин на каждую заявку. `pending` схлопывает параллельные заявки в один
 * запрос сессии — иначе два одновременных заказа делают два логина.
 */
let session: CachedSession | null = null;
let pending: Promise<CachedSession> | null = null;

/**
 * Вычищает из текста всё, что нельзя писать в лог.
 *
 * Короткие значения игнорируем: замена односимвольного «секрета» изрешетила бы
 * весь лог (`Posiflora` → `Posiflo<REDACTED>a`) и спрятала бы сообщение об
 * ошибке вместо того, чтобы прятать секрет. Настоящие пароли и токены длиннее.
 */
const MIN_SECRET_LENGTH = 8;

function redact(text: string, cfg: PosifloraConfig): string {
  const secrets = [
    cfg.password,
    session?.accessToken,
    session?.refreshToken,
  ].filter(
    (s): s is string => typeof s === "string" && s.length >= MIN_SECRET_LENGTH,
  );
  return secrets.reduce(
    (acc, secret) => acc.split(secret).join("<REDACTED>"),
    text,
  );
}

/**
 * Разворачивает undici-шную «fetch failed» до реальной причины (ENOTFOUND,
 * ETIMEDOUT…) — иначе по логам не отличить DNS от файрвола. Тот же приём,
 * что и в `lib/telegram.ts`.
 */
function describeError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause as (Error & { code?: string }) | undefined;
    const causeText = cause ? ` (${cause.code ?? cause.message})` : "";
    return `${err.message}${causeText}`;
  }
  return String(err);
}

type JsonApiError = {
  title?: unknown;
  detail?: unknown;
  code?: unknown;
  /** JSON:API: `pointer` указывает на поле, которое не прошло валидацию. */
  source?: { pointer?: unknown; parameter?: unknown } | null;
};

type JsonApiErrors = { errors?: JsonApiError[] };

/** «This value should not be blank. [/data/attributes/docNo]» */
function formatJsonApiError(e: JsonApiError): string {
  const text = [e.title, e.detail]
    .filter((v): v is string => typeof v === "string" && v !== "")
    .join(": ");
  const target = e.source?.pointer ?? e.source?.parameter;
  const where = typeof target === "string" && target ? ` [${target}]` : "";
  const code = typeof e.code === "string" && e.code ? ` (${e.code})` : "";
  return `${text || "без описания"}${code}${where}`;
}

/** Тело похоже на HTML-страницу (nginx, балансировщик), а не на JSON:API. */
function looksLikeHtml(body: string): boolean {
  return /^\s*<(?:!doctype|html|head|body)/i.test(body.trim());
}

/**
 * Posiflora возвращает ошибки массивом `errors` по JSON:API. Собираем из них
 * читаемую строку. `where` — метод и путь: без него по логу не понять, что
 * упало, логин или создание заказа.
 */
function describeApiError(status: number, body: string, where: string): string {
  try {
    const parsed = JSON.parse(body) as JsonApiErrors;
    const details = (parsed.errors ?? []).map(formatJsonApiError).filter(Boolean);
    if (details.length > 0) {
      return `Posiflora ${status} на ${where}: ${details.join("; ")}`;
    }
  } catch {
    // Не JSON — разбираем ниже.
  }

  // HTML вместо JSON:API означает, что запрос вообще не дошёл до API: его
  // принял веб-сервер. При 404/405 это почти всегда обрезанный
  // POSIFLORA_API_URL — база должна включать /api. Саму страницу в лог не
  // тащим: от неё только килобайты разметки.
  if (looksLikeHtml(body)) {
    const hint =
      status === 404 || status === 405
        ? " Проверьте POSIFLORA_API_URL: база должна заканчиваться на /api," +
          " например https://ваш-аккаунт.posiflora.com/api"
        : "";
    return `Posiflora ${status} на ${where}: вместо JSON:API пришла HTML-страница.${hint}`;
  }

  return `Posiflora ${status} на ${where}: ${body.slice(0, 300)}`;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value) {
    throw new Error(`Posiflora: в ответе нет поля ${field}`);
  }
  return value;
}

/**
 * `expireAt` приходит ISO-строкой с оффсетом ("2022-06-14T16:32:59+00:00").
 * Если поле вдруг отсутствует или не парсится, лучше считать сессию
 * короткоживущей, чем вечной, — иначе инстанс залипнет на мёртвом токене.
 */
function parseExpiry(value: unknown, fallbackMs: number): number {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now() + fallbackMs;
}

type SessionResponse = {
  data?: {
    attributes?: Record<string, unknown>;
    relationships?: { worker?: { data?: { id?: unknown } | null } };
  };
};

function toSession(payload: unknown): CachedSession {
  const data = (payload as SessionResponse)?.data;
  const attributes = data?.attributes ?? {};
  const workerId = data?.relationships?.worker?.data?.id;
  return {
    workerId: typeof workerId === "string" ? workerId : null,
    accessToken: requireString(attributes.accessToken, "accessToken"),
    refreshToken: requireString(attributes.refreshToken, "refreshToken"),
    // Значения по умолчанию — из документации: access ~1 час, refresh ~30 дней.
    expireAt: parseExpiry(attributes.expireAt, 60 * 60 * 1000),
    refreshExpireAt: parseExpiry(
      attributes.refreshExpireAt,
      30 * 24 * 60 * 60 * 1000,
    ),
  };
}

/** Общий вызов /v1/sessions: POST заводит сессию, PATCH продлевает. */
async function requestSession(
  cfg: PosifloraConfig,
  method: "POST" | "PATCH",
  attributes: Record<string, string>,
): Promise<CachedSession> {
  const where = `${method} /v1/sessions`;
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/v1/sessions`, {
      method,
      headers: { "Content-Type": JSON_API, Accept: JSON_API },
      body: JSON.stringify({ data: { type: "sessions", attributes } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(redact(`${where}: ${describeError(err)}`, cfg));
  }

  const body = await res.text();
  if (!res.ok) {
    throw new Error(redact(describeApiError(res.status, body, where), cfg));
  }

  try {
    return toSession(JSON.parse(body));
  } catch (err) {
    throw new Error(redact(`${where}: ${describeError(err)}`, cfg));
  }
}

async function negotiate(
  cfg: PosifloraConfig,
  now: number,
): Promise<CachedSession> {
  // Refresh ещё жив — продлеваем, это дешевле полного логина.
  if (session && session.refreshExpireAt - EXPIRY_SKEW_MS > now) {
    try {
      session = await requestSession(cfg, "PATCH", {
        refreshToken: session.refreshToken,
      });
      return session;
    } catch (err) {
      // Отозванный или протухший refresh не должен ронять заявку — просто
      // логинимся заново. Пишем в лог: постоянные отказы здесь означают,
      // что с учёткой что-то не так.
      console.warn("Posiflora refresh failed, re-login:", describeError(err));
      session = null;
    }
  }

  session = await requestSession(cfg, "POST", {
    username: cfg.username,
    password: cfg.password,
  });
  return session;
}

/** Действующая сессия: из кэша, продлением или новым логином. */
async function ensureSession(cfg: PosifloraConfig): Promise<CachedSession> {
  const now = Date.now();
  if (session && session.expireAt - EXPIRY_SKEW_MS > now) return session;
  pending ??= negotiate(cfg, now).finally(() => {
    pending = null;
  });
  return pending;
}

/** Действующий access-токен. */
export async function getAccessToken(cfg: PosifloraConfig): Promise<string> {
  return (await ensureSession(cfg)).accessToken;
}

/** Сбрасывает кэш — нужен, когда API ответил 401 на, казалось бы, живой токен. */
export function invalidateSession(): void {
  session = null;
}


/** Что вернулось из Posiflora после создания заказа. */
export type PosifloraOrder = {
  id: string;
  /** Номер документа, который видит менеджер в интерфейсе. */
  docNo: string | null;
  status: string | null;
};

/**
 * `disabled` — интеграция не настроена (нет env), это штатный режим:
 * заявка тогда уходит только в Telegram, как было до Posiflora.
 */
export type PosifloraOutcome =
  | { status: "created"; order: PosifloraOrder }
  | { status: "disabled" }
  | { status: "failed"; error: string };

/** Дата заказа в часовом поясе магазина; сервер ждёт YYYY-MM-DD. */
function storeDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** «2022-07-19T09:01:55Z» — формат из документации, без миллисекунд. */
function isoSeconds(now: Date): string {
  return now.toISOString().replace(/\.\d+Z$/, "Z");
}

/**
 * Заказ создаётся без привязки к клиенту, поэтому все контакты живут
 * в `description` — это единственное поле карточки, где менеджер их увидит.
 */
function buildDescription(data: OrderInput): string {
  const lines = [`Заявка с сайта ${site.domain}`, `ФИО: ${data.fullName}`, `Телефон: ${data.phone}`];

  const nick = data.telegramNick?.trim();
  if (nick) lines.push(`Telegram: ${nick}`);

  const methods = contactMethodLabels(data.contactMethods);
  if (methods) lines.push(`Способ связи: ${methods}`);

  const category = data.category?.trim();
  if (category) lines.push(`Что нужно: ${category}`);

  const comment = data.comment?.trim();
  if (comment) lines.push(`Комментарий: ${comment}`);

  // Тот же след согласия, что и в сообщении Telegram (ч. 3 ст. 9 152-ФЗ).
  lines.push(
    `Согласие на обработку ПДн подтверждено на сайте (редакция документов от ${site.privacyRevision})`,
  );

  return lines.join("\n");
}

/** Связь JSON:API: ссылка на ресурс. */
function ref(type: string, id: string) {
  return { data: { type, id } };
}

type OrderIds = {
  storeId: string;
  sourceId?: string;
  workerId?: string;
};

function buildOrderPayload(data: OrderInput, ids: OrderIds, now: Date) {
  const timestamp = isoSeconds(now);
  return {
    data: {
      type: "orders",
      // id генерируем сами: Posiflora принимает клиентский UUID и возвращает его же.
      id: randomUUID(),
      attributes: {
        budget: 0,
        byBonuses: false,
        createdAt: timestamp,
        date: storeDate(now),
        description: buildDescription(data),
        fiscal: false,
        status: "new",
        updatedAt: timestamp,
        // Адрес доставки форма не собирает — менеджер уточняет его при звонке.
        // Пустые строки и null-таймеры отправляем явно, как в примере из
        // документации: сервер валидирует поля на «не пусто», а отсутствующее
        // поле для него не то же самое, что пустое.
        delivery: false,
        deliveryApartment: "",
        deliveryBuilding: "",
        deliveryCity: "",
        deliveryComments: "",
        deliveryContact: "",
        deliveryHouse: "",
        deliveryPhoneCode: "",
        deliveryPhoneNumber: "",
        deliveryStreet: "",
        deliveryTimeFrom: null,
        deliveryTimeTo: null,
        dueTime: null,
      },
      // Только те связи, что объявлены в схеме POST /v1/orders. Состав заказа
      // (lines) не шлём вовсе: с сайта приходит пожелание, а не корзина —
      // позиции добавит флорист.
      relationships: {
        // Заказ без клиента — контакты лежат в description. Явный null у
        // customer и florist взят из примера документации, там он принимается.
        customer: { data: null },
        florist: { data: null },
        store: ref("stores", ids.storeId),
        // Необязательные связи: если id не задан, ключ не отправляем вовсе —
        // «data: null» здесь документацией не подтверждён и валидацию не проходит.
        ...(ids.sourceId ? { source: ref("order-sources", ids.sourceId) } : {}),
        ...(ids.workerId ? { createdBy: ref("workers", ids.workerId) } : {}),
      },
    },
  };
}

type OrderResponse = {
  data?: { id?: unknown; attributes?: Record<string, unknown> };
};

async function postOrder(
  cfg: PosifloraConfig,
  payload: ReturnType<typeof buildOrderPayload>,
): Promise<PosifloraOrder> {
  const send = async () =>
    fetch(`${cfg.baseUrl}/v1/orders`, {
      method: "POST",
      headers: {
        "Content-Type": JSON_API,
        Accept: JSON_API,
        Authorization: `Bearer ${(await ensureSession(cfg)).accessToken}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

  let res: Response;
  try {
    res = await send();
    // Сессию могли отозвать на стороне Posiflora — один ретрай с новым логином.
    if (res.status === 401) {
      invalidateSession();
      res = await send();
    }
  } catch (err) {
    throw new Error(redact(`POST /v1/orders: ${describeError(err)}`, cfg));
  }

  const body = await res.text();
  if (!res.ok) {
    throw new Error(
      redact(describeApiError(res.status, body, "POST /v1/orders"), cfg),
    );
  }

  let parsed: OrderResponse;
  try {
    parsed = JSON.parse(body) as OrderResponse;
  } catch {
    // Заказ, скорее всего, создан (201), но тело не разобралось — отдаём свой
    // UUID, чтобы менеджер мог найти заказ, и не роняем заявку.
    return { id: payload.data.id, docNo: null, status: null };
  }

  const attributes = parsed.data?.attributes ?? {};
  return {
    id: typeof parsed.data?.id === "string" ? parsed.data.id : payload.data.id,
    docNo: typeof attributes.docNo === "string" ? attributes.docNo : null,
    status: typeof attributes.status === "string" ? attributes.status : null,
  };
}

/**
 * Создаёт заказ в Posiflora. Никогда не бросает: вызывающий код решает по
 * `status`, показывать клиенту ошибку или нет.
 */
export async function createPosifloraOrder(
  data: OrderInput,
): Promise<PosifloraOutcome> {
  const cfg = readPosifloraConfig();
  if (!cfg) return { status: "disabled" };

  const storeId = process.env.POSIFLORA_STORE_ID;
  if (!storeId) {
    return {
      status: "failed",
      error:
        "POSIFLORA_STORE_ID не задан: заказ невозможно привязать к точке продаж.",
    };
  }

  try {
    // Сотрудник по умолчанию — тот, под чьей учёткой залогинились: его id
    // приходит в ответе на логин, так что отдельная переменная не нужна.
    const { workerId } = await ensureSession(cfg);
    const ids: OrderIds = {
      storeId,
      sourceId: process.env.POSIFLORA_SOURCE_ID,
      workerId: process.env.POSIFLORA_WORKER_ID ?? workerId ?? undefined,
    };
    const order = await postOrder(cfg, buildOrderPayload(data, ids, new Date()));
    return { status: "created", order };
  } catch (err) {
    return { status: "failed", error: describeError(err) };
  }
}
