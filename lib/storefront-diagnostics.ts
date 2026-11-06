/** Diagnostics belong in server logs, not in the shopper's checkout. */
export function catalogFailureHint(status: number, contentType: string): string {
  if (status === 401 || status === 403) {
    return contentType.includes("json")
      ? "Стебель отклонил ключ сайта. Проверьте STEBEL_SITE_KEY и действующую точку ключа."
      : "Доступ отклонил веб-сервер. Проверьте пароль стенда и доступ к /api/site/catalog.";
  }
  if (status === 404 || status === 405) {
    return "Проверьте STEBEL_API_URL и версию Стебля: нужен endpoint GET /api/site/catalog.";
  }
  if (status >= 500) return "Ошибка сервера Стебля. Проверьте журнал API и применение миграций 0038/0039.";
  if (contentType.includes("html")) return "Вместо каталога пришла HTML-страница. Проверьте STEBEL_API_URL: путь API обычно /api.";
  return "Проверьте формат ответа и совместимость версий сайта и Стебля.";
}

export function safeCatalogDiagnostic(value: unknown, key: string): string {
  let text = typeof value === "string" ? value : "";
  // Redact before truncation, including keys accidentally echoed by an upstream.
  if (key) text = text.split(key).join("[REDACTED]");
  return text.replace(/stebel_site_[a-zA-Z0-9_-]+/g, "[REDACTED]").slice(0, 500);
}
