"use client";

import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { useStorefront } from "./StorefrontProvider";

/** Both catalog pages show the same fresh stock and connection feedback. */
export function StorefrontStatus() {
  const { state, error, refreshing, refreshedAt, refresh } = useStorefront();
  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-muted">
          {refreshing ? "Проверяем актуальное наличие…" : state === "ready" && refreshedAt !== null
            ? `Наличие обновлено в ${new Date(refreshedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
            : state === "unavailable" ? "Не удалось обновить наличие" : "Загружаем витрину…"}
        </p>
        <button
          type="button" onClick={() => void refresh()} disabled={refreshing} aria-busy={refreshing}
          className="flex min-h-11 items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-rose transition-colors hover:border-rose/50 disabled:cursor-wait disabled:opacity-60"
        >
          <ArrowClockwise size={18} aria-hidden="true" className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
          {refreshing ? "Обновляем…" : "Обновить витрину"}
        </button>
      </div>
      {state === "loading" ? <div role="status" className="mt-8 rounded-2xl border border-line p-8 text-muted">Проверяем, что есть в студии…</div> : null}
      {state === "unavailable" && !refreshing ? (
        <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-bg-soft p-5">
          <p className="text-sm text-muted">{error}</p>
          <a href="#order" className="text-sm text-muted underline underline-offset-4">Обсудить букет с флористом</a>
        </div>
      ) : null}
    </>
  );
}
