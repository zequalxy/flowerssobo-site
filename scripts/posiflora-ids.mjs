#!/usr/bin/env node
/**
 * Поиск идентификаторов Posiflora, которых нет в личном кабинете на виду:
 * точка продаж (stores), источник заказа (order-sources) и сотрудник (workers).
 *
 *   node scripts/posiflora-ids.mjs
 *
 * Логин/пароль берутся из переменных окружения или из .env.local. Можно
 * передать их и аргументами:
 *
 *   node scripts/posiflora-ids.mjs <api-url> <username> <password>
 *
 * Скрипт только читает справочники и ничего не меняет. Пароль и токен
 * не печатаются.
 */
import { readFileSync } from "node:fs";

const JSON_API = "application/vnd.api+json";

/** Минимальный парсер .env.local — чтобы не тащить зависимость ради трёх строк. */
function readEnvFile(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const file = readEnvFile(new URL("../.env.local", import.meta.url).pathname);
const [argUrl, argUser, argPass] = process.argv.slice(2);

const apiUrl = (argUrl ?? process.env.POSIFLORA_API_URL ?? file.POSIFLORA_API_URL ?? "").replace(/\/+$/, "");
const username = argUser ?? process.env.POSIFLORA_USERNAME ?? file.POSIFLORA_USERNAME;
const password = argPass ?? process.env.POSIFLORA_PASSWORD ?? file.POSIFLORA_PASSWORD;

if (!apiUrl || !username || !password) {
  console.error(
    "Нужны POSIFLORA_API_URL, POSIFLORA_USERNAME и POSIFLORA_PASSWORD —\n" +
      "в окружении, в .env.local или аргументами командной строки.\n\n" +
      "  node scripts/posiflora-ids.mjs https://ваш-аккаунт.posiflora.com/api логин пароль",
  );
  process.exit(1);
}

async function api(path, token) {
  const res = await fetch(`${apiUrl}${path}`, {
    headers: {
      Accept: JSON_API,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`GET ${path} → ${res.status}: ${body.slice(0, 300)}`);
  }
  return JSON.parse(body);
}

async function login() {
  const res = await fetch(`${apiUrl}/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": JSON_API, Accept: JSON_API },
    body: JSON.stringify({
      data: { type: "sessions", attributes: { username, password } },
    }),
  });
  const body = await res.text();
  if (!res.ok) {
    throw new Error(`Логин не прошёл → ${res.status}: ${body.slice(0, 300)}`);
  }
  return JSON.parse(body).data;
}

/** Короткое имя ресурса для списка — у каждого справочника оно своё. */
function label(item) {
  const a = item.attributes ?? {};
  if (a.title) return a.address ? `${a.title} — ${a.address}` : a.title;
  const name = [a.lastName, a.firstName].filter(Boolean).join(" ");
  return name || "(без названия)";
}

function printList(heading, items, extra = () => "") {
  console.log(`\n${heading}`);
  if (items.length === 0) {
    console.log("  (пусто)");
    return;
  }
  for (const item of items) {
    console.log(`  ${item.id}  ${label(item)}${extra(item)}`);
  }
}

try {
  const session = await login();
  const token = session.attributes.accessToken;
  const workerId = session.relationships?.worker?.data?.id ?? null;
  console.log(`Логин ок. Сотрудник этой учётки: ${workerId ?? "не определён"}`);
  console.log("(он и подставится в createdBy, отдельная переменная не нужна)");

  const [stores, sources, workers] = await Promise.all([
    api("/v1/stores", token),
    api("/v1/order-sources", token),
    api("/v1/workers?activeOnly=true", token),
  ]);

  printList("Точки продаж — POSIFLORA_STORE_ID:", stores.data);
  printList("Источники заказа — POSIFLORA_SOURCE_ID:", sources.data, (i) =>
    i.attributes?.hidden ? "  (скрыт)" : "",
  );
  printList("Сотрудники — POSIFLORA_WORKER_ID (необязательно):", workers.data);

  // Готовый блок для .env.local: точку берём, если она одна, источник —
  // если нашёлся похожий на «Сайт».
  const store = stores.data.length === 1 ? stores.data[0] : null;
  const site = sources.data.find((s) =>
    /сайт|site/i.test(s.attributes?.title ?? ""),
  );

  console.log("\n--- в .env.local ---");
  console.log(`POSIFLORA_API_URL=${apiUrl}`);
  console.log(`POSIFLORA_USERNAME=${username}`);
  console.log("POSIFLORA_PASSWORD=<ваш пароль>");
  console.log(
    `POSIFLORA_STORE_ID=${store ? store.id : "<id из списка точек продаж выше>"}`,
  );
  console.log(
    `POSIFLORA_SOURCE_ID=${site ? site.id : "<id источника; заведите «Сайт», если его нет>"}`,
  );
  if (!site) {
    console.log(
      "\nИсточник «Сайт» не найден — как его создать, см. README, раздел\n" +
        "«Как найти идентификаторы Posiflora».",
    );
  }
} catch (err) {
  console.error(`\nОшибка: ${err.message}`);
  process.exit(1);
}
