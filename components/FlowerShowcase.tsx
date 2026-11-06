"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Flower } from "@phosphor-icons/react/dist/ssr";
import { QuantityControl } from "@/components/StorefrontCart";
import { useStorefront } from "@/components/StorefrontProvider";
import { StorefrontStatus } from "@/components/StorefrontStatus";
import { Reveal } from "@/components/ui/Reveal";
import { formatKopecks } from "@/lib/storefront";
import { cn } from "@/lib/utils";

export function FlowerShowcase() {
  const { catalog, cart, state } = useStorefront();
  const quantities = new Map(cart.map((line) => [line.id, line.quantity]));
  const flowers = catalog?.items.filter((item) =>
    item.kind === "flower" && (item.available > 0 || quantities.has(item.id)),
  ) ?? [];
  const packaging = catalog?.items.filter((item) =>
    item.kind === "packaging" && (item.available > 0 || quantities.has(item.id)),
  ) ?? [];
  const ready = state === "ready";

  return (
    <section id="flowers" className="relative pb-16 pt-28 md:pb-24 md:pt-36">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <Link
          href="/#bouquets"
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted transition-colors hover:text-rose"
        >
          <ArrowLeft size={17} aria-hidden="true" />
          Готовые букеты
        </Link>

        <Reveal className="mt-5 max-w-3xl">
          <p className="eyebrow">Цветы по вашему вкусу</p>
          <h1 className="mt-4 text-balance text-4xl tracking-tight md:text-6xl">
            Собрать свой букет
          </h1>
          <p className="mt-4 max-w-2xl text-pretty leading-relaxed text-muted">
            Выберите любимые цветы и количество, добавьте упаковку по желанию.
            Флорист подтвердит наличие и соберёт ваш букет.
          </p>
        </Reveal>

        <ol aria-label="Как собрать букет" className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted sm:gap-x-8 sm:text-sm">
          {[["01", "Выберите цветы"], ["02", "Добавьте упаковку"], ["03", "Оставьте заявку"]].map(([number, label]) => (
            <li key={number} className="flex items-center gap-2">
              <span className="font-semibold tabular-nums text-rose">{number}</span>
              {label}
            </li>
          ))}
        </ol>

        <div className="mt-8 border-t border-line pt-1">
          <StorefrontStatus />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:gap-4 lg:grid-cols-4">
          {flowers.map((item) => {
            const quantity = quantities.get(item.id) ?? 0;
            return (
              <article
                key={item.id}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-2xl border bg-bg-elev transition-colors duration-200",
                  quantity > 0 ? "border-rose/60 ring-1 ring-rose/15" : "border-line",
                )}
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-bg-soft">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-rose/40">
                      <Flower size={56} weight="light" aria-hidden="true" />
                    </div>
                  )}
                  {quantity > 0 ? (
                    <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-bg/95 px-2.5 py-1.5 text-[11px] font-semibold text-rose backdrop-blur-sm">
                      <Check size={13} weight="bold" aria-hidden="true" />
                      В букете: {quantity}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-1 flex-col p-3 md:p-4">
                  <h2 className="text-sm font-semibold leading-snug md:text-base">{item.name}</h2>
                  {item.description ? <p className="mt-2 text-xs leading-relaxed text-muted">{item.description}</p> : null}
                  <p className="mt-3 text-sm font-semibold tabular-nums md:text-base">
                    {item.priceKopecks === null ? "Цена уточняется" : <>{formatKopecks(item.priceKopecks)} <span className="text-xs font-normal text-muted">/ шт.</span></>}
                  </p>
                  <p className="mb-3 mt-1 text-xs text-muted">
                    {!ready ? "Наличие уточняется" : item.available > 0 ? `В студии: ${item.available} шт.` : "Сейчас нет в наличии"}
                  </p>
                  <div className="mt-auto"><QuantityControl item={item} compact /></div>
                </div>
              </article>
            );
          })}

          {ready && !flowers.length ? (
            <div className="col-span-full rounded-[1.75rem] border border-line bg-bg-soft px-6 py-10 text-center md:py-14">
              <Flower size={36} weight="light" className="mx-auto text-rose" aria-hidden="true" />
              <h2 className="mt-4 text-2xl">Цветы для вашего букета скоро появятся</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-muted">
                Пока загляните в готовые букеты или расскажите флористу, что вам нравится.
                Поможем подобрать цветы под ваш повод.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link href="/#bouquets" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-rose px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-rose-deep">
                  Готовые букеты <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <a href="#order" className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-5 py-3 text-sm font-semibold transition-colors hover:bg-surface-hover">
                  Помощь флориста
                </a>
              </div>
            </div>
          ) : null}
        </div>

        {packaging.length ? (
          <div className="mt-12 rounded-[1.75rem] border border-sage/30 bg-sage/10 p-5 md:mt-16 md:p-8">
            <p className="eyebrow">Последний штрих</p>
            <h2 className="mt-3 text-2xl tracking-tight md:text-3xl">Упаковка для вашего букета</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
              Добавьте понравившийся вариант или оставьте выбор флористу в пожеланиях.
              Для готовых букетов оформление уже входит в цену.
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {packaging.map((item) => (
                <article key={item.id} className={cn(
                  "flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-bg p-4",
                  quantities.has(item.id) ? "border-rose/60" : "border-line",
                )}>
                  <div className="min-w-0 flex-1 basis-32">
                    <h3 className="text-sm font-semibold">{item.name}</h3>
                    <p className="mt-1 text-sm tabular-nums text-muted">
                      {item.priceKopecks === null ? "Цена уточняется" : formatKopecks(item.priceKopecks)}
                    </p>
                    {ready && item.available === 0 ? <p className="mt-1 text-xs text-muted">Сейчас нет в наличии</p> : null}
                  </div>
                  <QuantityControl item={item} compact />
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
