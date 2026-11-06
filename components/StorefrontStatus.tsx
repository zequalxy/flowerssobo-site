"use client";

import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { useStorefront } from "./StorefrontProvider";

/** Stock refreshes in the background; show controls only when help is needed. */
export function StorefrontStatus() {
  const { state, error, refreshing, refresh } = useStorefront();
  if (state === "ready") return null;
  if (state === "loading") return (
    <div role="status" className="mt-8 rounded-2xl border border-line p-8 text-muted">Проверяем, что есть в студии…</div>
  );

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-bg-soft p-5">
      <p role="status" aria-live="polite" aria-atomic="true" className="text-sm text-muted">
        {refreshing ? "Проверяем актуальное наличие…" : error || "Не удалось загрузить витрину. Попробуйте ещё раз."}
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button" onClick={() => void refresh()} disabled={refreshing} aria-busy={refreshing}
          className="flex min-h-11 items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-rose transition-colors hover:border-rose/50 disabled:cursor-wait disabled:opacity-60"
        >
          <ArrowClockwise size={18} aria-hidden="true" className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
          {refreshing ? "Проверяем…" : "Попробовать снова"}
        </button>
        <a href="#order" className="text-sm text-muted underline underline-offset-4">Обсудить букет с флористом</a>
      </div>
    </div>
  );
}
