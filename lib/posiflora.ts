/**
 * Клиент Posiflora API (JSON:API).
 *
 * Здесь только слой сессии: логин по паре username/password, кэш access-токена
 * и его продление по refresh-токену. Создание заказа лежит в `createOrder`.
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
};

/**
 * Кэш живёт в памяти инстанса. На serverless это best-effort (у каждого
 * холодного инстанса свой), но в пределах одного инстанса убирает лишний
 * логин на каждую заявку. `pending` схлопывает параллельные заявки в один
 * запрос сессии — иначе два одновременных заказа делают два логина.
 */
let session: CachedSession | null = null;
let pending: Promise<CachedSession> | null = null;

/** Вычищает из текста всё, что нельзя писать в лог. */
function redact(text: string, cfg: PosifloraConfig): string {
  const secrets = [
    cfg.password,
    session?.accessToken,
    session?.refreshToken,
  ].filter((s): s is string => Boolean(s));
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

type JsonApiErrors = {
  errors?: Array<{ title?: unknown; detail?: unknown; code?: unknown }>;
};

/**
 * Posiflora возвращает ошибки массивом `errors` по JSON:API. Собираем из них
 * читаемую строку; если тело не разобралось — отдаём сырой текст, урезанный,
 * чтобы HTML-страница от балансировщика не утащила в лог килобайты.
 */
function describeApiError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as JsonApiErrors;
    const details = (parsed.errors ?? [])
      .map((e) =>
        [e.title, e.detail].filter((v) => typeof v === "string").join(": "),
      )
      .filter(Boolean);
    if (details.length > 0) return `Posiflora ${status}: ${details.join("; ")}`;
  } catch {
    // Не JSON — ниже уйдёт сырой ответ.
  }
  return `Posiflora ${status}: ${body.slice(0, 300)}`;
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
  data?: { attributes?: Record<string, unknown> };
};

function toSession(payload: unknown): CachedSession {
  const attributes = (payload as SessionResponse)?.data?.attributes ?? {};
  return {
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
  let res: Response;
  try {
    res = await fetch(`${cfg.baseUrl}/v1/sessions`, {
      method,
      headers: { "Content-Type": JSON_API, Accept: JSON_API },
      body: JSON.stringify({ data: { type: "sessions", attributes } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(redact(describeError(err), cfg));
  }

  const body = await res.text();
  if (!res.ok) throw new Error(redact(describeApiError(res.status, body), cfg));

  try {
    return toSession(JSON.parse(body));
  } catch (err) {
    throw new Error(redact(describeError(err), cfg));
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

/** Действующий access-токен: из кэша, продлением или новым логином. */
export async function getAccessToken(cfg: PosifloraConfig): Promise<string> {
  const now = Date.now();
  if (session && session.expireAt - EXPIRY_SKEW_MS > now) {
    return session.accessToken;
  }
  pending ??= negotiate(cfg, now).finally(() => {
    pending = null;
  });
  return (await pending).accessToken;
}

/** Сбрасывает кэш — нужен, когда API ответил 401 на, казалось бы, живой токен. */
export function invalidateSession(): void {
  session = null;
}

