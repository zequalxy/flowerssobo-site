"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Flower } from "@phosphor-icons/react/dist/ssr";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetail } from "@/components/ProductDetail";
import { Reveal } from "@/components/ui/Reveal";
import { useStorefront } from "./StorefrontProvider";
import { StorefrontStatus } from "./StorefrontStatus";

export function Showcase() {
  const reduce = useReducedMotion();
  const { catalog, state } = useStorefront();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = catalog?.items.find((item) => item.id === selectedId);
  const close = useCallback(() => setSelectedId(null), []);
  const bouquets = catalog?.items.filter((item) => item.kind === "bouquet" && item.available > 0) ?? [];
  const ready = state === "ready";

  return (
    <section id="bouquets" data-analytics-view="bouquets_view" className="relative scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="eyebrow">Витрина студии</p>
              <h2 className="mt-4 text-balance text-4xl tracking-tight md:text-5xl">Готовые букеты</h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted">Уже собраны нашими флористами. Выберите тот самый — мы подтвердим наличие и согласуем доставку или самовывоз.</p>
            </div>
            <Link href="/flowers" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 self-start rounded-full border border-rose/40 px-6 py-3 text-sm font-semibold text-rose transition-colors hover:bg-rose hover:text-white lg:self-auto">
              Собрать свой букет <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
        <StorefrontStatus />
        <div className="mt-8 grid grid-cols-2 gap-3 md:mt-10 md:gap-4 lg:grid-cols-3">
          {bouquets.map((item) => <ProductCard key={item.id} product={item} onOpen={(item) => setSelectedId(item.id)} reduce={reduce} ready={ready} />)}
          {ready && !bouquets.length ? (
            <div className="col-span-full rounded-2xl border border-line bg-bg-soft p-6 sm:p-8">
              <p className="font-display text-xl">Новые букеты ещё собираются</p>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">Выберите цветы поштучно или расскажите флористу, какой букет вам хочется.</p>
              <div className="mt-5 flex flex-wrap gap-5 text-sm font-semibold text-rose">
                <Link href="/flowers" className="underline underline-offset-4">Выбрать цветы</Link>
                <a href="#order" className="underline underline-offset-4">Помочь с выбором</a>
              </div>
            </div>
          ) : null}
        </div>
        <Link href="/flowers" className="group mt-8 flex flex-col gap-5 rounded-3xl border border-sage/30 bg-sage/10 p-6 transition-colors hover:bg-sage/20 sm:flex-row sm:items-center sm:p-8">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-bg text-rose"><Flower size={30} weight="light" aria-hidden="true" /></span>
          <div className="flex-1">
            <h3 className="font-display text-xl md:text-2xl">Ваши любимые цветы. Ваше сочетание.</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Выберите цветы поштучно и добавьте упаковку. Мы бережно соберём всё в букет.</p>
          </div>
          <span className="flex items-center gap-2 text-sm font-semibold text-rose">Собрать свой букет <ArrowUpRight size={20} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none" /></span>
        </Link>
      </div>
      <AnimatePresence>{selected ? <motion.div key="bouquet-backdrop" onClick={close} className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} /> : null}</AnimatePresence>
      <AnimatePresence>{selected ? <ProductDetail key={selected.id} product={selected} onClose={close} reduce={reduce} /> : null}</AnimatePresence>
    </section>
  );
}
