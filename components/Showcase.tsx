"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Flower, ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetail } from "@/components/ProductDetail";
import { Reveal } from "@/components/ui/Reveal";
import { useStorefront } from "./StorefrontProvider";
import { QuantityControl } from "./StorefrontCart";
import { formatKopecks } from "@/lib/storefront";

export function Showcase() {
  const reduce = useReducedMotion();
  const { catalog, state, error, refreshing, refreshedAt, refresh } = useStorefront();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"bouquets" | "flowers">("bouquets");
  const selected = catalog?.items.find((item) => item.id === selectedId);
  const close = useCallback(() => setSelectedId(null), []);
  const bouquets = catalog?.items.filter((item) => item.kind === "bouquet" && item.available > 0) ?? [];
  const flowers = catalog?.items.filter((item) => item.kind === "flower") ?? [];
  const packaging = catalog?.items.filter((item) => item.kind === "packaging") ?? [];
  const ready = state === "ready";
  return (
    <section id="bouquets" className="relative scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <Reveal><div className="max-w-2xl"><p className="eyebrow">Витрина</p><h2 className="mt-4 text-balance text-4xl tracking-tight md:text-5xl">Ваш букет начинается здесь</h2><p className="mt-4 text-pretty leading-relaxed text-muted">Выберите уже собранный букет или наберите любимые цветы поштучно. Мы подтвердим наличие и бережно подготовим ваш заказ.</p></div></Reveal>
        <div className="mt-8 inline-flex max-w-full gap-1 rounded-full border border-line bg-bg-soft p-1" role="group" aria-label="Раздел витрины">
          {([ ["bouquets", "Готовые букеты"], ["flowers", "Собрать свой букет"] ] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)} className={`rounded-full px-4 py-3 text-xs font-semibold transition-colors sm:px-6 sm:text-sm ${tab === id ? "bg-rose text-white" : "text-muted hover:text-ink"}`}>{label}</button>)}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p role="status" aria-live="polite" aria-atomic="true" className="text-xs text-muted">
            {refreshing ? "Проверяем актуальное наличие…" : ready && refreshedAt !== null
              ? `Наличие обновлено в ${new Date(refreshedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
              : state === "unavailable" ? "Не удалось обновить наличие" : "Загружаем витрину…"}
          </p>
          <button type="button" onClick={() => void refresh()} disabled={refreshing}
            aria-busy={refreshing}
            className="flex min-h-11 items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-rose transition-colors hover:border-rose/50 disabled:cursor-wait disabled:opacity-60">
            <ArrowClockwise size={18} aria-hidden="true" className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
            {refreshing ? "Обновляем…" : "Обновить витрину"}
          </button>
        </div>
        {state === "loading" ? <div role="status" className="mt-10 rounded-2xl border border-line p-8 text-muted">Проверяем, что есть в студии…</div> : null}
        {state === "unavailable" && !refreshing ? <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-bg-elev p-5"><p className="text-sm text-muted">{error}</p><a href="#order" className="text-sm text-muted underline underline-offset-4">Обсудить букет с флористом</a></div> : null}
        {tab === "bouquets" ? <div className="mt-10 grid grid-cols-2 gap-3 md:mt-12 md:gap-4 lg:grid-cols-3">
          {bouquets.map((item) => <ProductCard key={item.id} product={item} onOpen={(item) => setSelectedId(item.id)} reduce={reduce} ready={ready} />)}
          {ready && !bouquets.length ? <p className="col-span-full rounded-2xl border border-line p-8 text-muted">Сейчас свободных готовых букетов нет. Выберите цветы во вкладке «Собрать свой букет» или расскажите флористу о своих пожеланиях.</p> : null}
        </div> : <>
          <div className="mt-10 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
            {flowers.map((item) => <article key={item.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-elev">
              <div className="relative aspect-[4/5] overflow-hidden bg-bg-soft">{item.imageUrl ? <Image src={item.imageUrl} alt={item.name} fill unoptimized sizes="(max-width: 1024px) 50vw, 25vw" className="object-cover" /> : <div className="flex h-full items-center justify-center text-rose/40"><Flower size={56} weight="light" /></div>}</div>
              <div className="flex flex-1 flex-col p-3 md:p-4"><h3 className="font-display text-sm font-semibold md:text-base">{item.name}</h3>{item.description ? <p className="mt-2 text-xs leading-relaxed text-muted">{item.description}</p> : null}<p className="mt-3 text-sm font-semibold tabular-nums">{item.priceKopecks === null ? "Цена уточняется" : `${formatKopecks(item.priceKopecks)} / шт.`}</p><p className="mb-3 mt-1 text-xs text-muted">{!ready ? "Наличие уточняется" : item.available > 0 ? `В студии: ${item.available} шт.` : "Сейчас нет в наличии"}</p><div className="mt-auto"><QuantityControl item={item} compact /></div></div>
            </article>)}
            {ready && !flowers.length ? <p className="col-span-full rounded-2xl border border-line p-8 text-muted">Поштучный выбор скоро появится. Пока можно выбрать готовый букет или оставить пожелания флористу.</p> : null}
          </div>
          {packaging.length ? <div className="mt-10"><h3 className="font-display text-2xl">Последний штрих — упаковка</h3><p className="mt-2 text-sm text-muted">Добавьте к выбранным цветам. Для готовых букетов оформление уже входит в цену.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{packaging.map((item) => <div key={item.id} className="flex items-center gap-4 rounded-2xl border border-line bg-bg-elev p-4"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.name}</p><p className="mt-1 text-sm text-muted">{item.priceKopecks === null ? "Цена уточняется" : formatKopecks(item.priceKopecks)}</p></div><QuantityControl item={item} compact /></div>)}</div></div> : null}
        </>}
      </div>
      <AnimatePresence>{selected ? <motion.div key="bouquet-backdrop" onClick={close} className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} /> : null}</AnimatePresence>
      <AnimatePresence>{selected ? <ProductDetail key={selected.id} product={selected} onClose={close} reduce={reduce} /> : null}</AnimatePresence>
    </section>
  );
}
