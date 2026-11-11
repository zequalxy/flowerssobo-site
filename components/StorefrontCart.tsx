"use client";

import { ArrowRight, Minus, Plus, Trash, ShoppingBag } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useStorefront } from "./StorefrontProvider";
import { formatKopecks, MAX_ITEM_QUANTITY, type StorefrontItem } from "@/lib/storefront";

export function QuantityControl({ item, compact = false }: { item: StorefrontItem; compact?: boolean }) {
  const { cart, setQuantity, state, checkoutPending } = useStorefront();
  const quantity = cart.find((line) => line.id === item.id)?.quantity ?? 0;
  const disabled = checkoutPending || state !== "ready" || item.priceKopecks === null || item.priceKopecks < 1;
  return (
    <div className={`flex items-center justify-between gap-2 rounded-full border border-line bg-bg-soft ${compact ? "p-1" : "p-1.5"}`} role="group" aria-label={`Количество: ${item.name}`}>
      <button type="button" aria-label={`Убрать одну: ${item.name}`} disabled={checkoutPending || quantity === 0} onClick={() => setQuantity(item.id, quantity - 1)} className="flex size-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-rose/15 disabled:opacity-30"><Minus size={16} /></button>
      <input type="number" inputMode="numeric" min={0} max={Math.min(item.available, MAX_ITEM_QUANTITY)} value={quantity} disabled={disabled}
        aria-label={`Количество ${item.name}`} onChange={(event) => { if (/^\d*$/.test(event.target.value)) setQuantity(item.id, Number(event.target.value)); }}
        className="w-9 appearance-none bg-transparent text-center text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-rose/40 disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
      <button type="button" aria-label={`Добавить одну: ${item.name}`} disabled={disabled || quantity >= Math.min(item.available, MAX_ITEM_QUANTITY)} onClick={() => setQuantity(item.id, quantity + 1)} className="flex size-9 items-center justify-center rounded-full bg-rose text-white transition-colors hover:bg-rose-deep disabled:opacity-30"><Plus size={16} /></button>
    </div>
  );
}

export function StorefrontCart({ sticky = false }: { sticky?: boolean }) {
  const { cart, catalog, total, cartError, checkoutPending, setQuantity, clear, refresh } = useStorefront();
  const onlyCustomBouquet = cart.some((line) => catalog?.items.find((item) => item.id === line.id)?.kind === "flower") &&
    cart.every((line) => {
      const kind = catalog?.items.find((item) => item.id === line.id)?.kind;
      return kind === "flower" || kind === "packaging";
    });
  const [atForm, setAtForm] = useState(false);
  useEffect(() => {
    if (!sticky || !window.IntersectionObserver) return;
    const form = document.getElementById("order");
    if (!form) return;
    const observer = new IntersectionObserver(([entry]) => setAtForm(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(form);
    return () => observer.disconnect();
  }, [sticky]);
  if (!cart.length) return null;
  if (sticky && atForm) return null;
  if (sticky) return (
    <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md pb-[env(safe-area-inset-bottom)] md:bottom-6">
      <a href="#order" data-analytics-event="cart_view" className="flex items-center justify-between gap-4 rounded-full border border-rose/40 bg-rose px-5 py-4 text-white shadow-[0_12px_40px_rgba(0,0,0,0.35)] transition-colors hover:bg-rose-deep">
        <span className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag size={21} />{checkoutPending ? "Проверить отправку заявки" : onlyCustomBouquet ? "Мой букет" : "Мой выбор"}</span>
        <span className="flex items-center gap-2 text-sm font-semibold tabular-nums">{checkoutPending ? null : formatKopecks(total)}<ArrowRight size={18} /></span>
      </a>
    </div>
  );
  return (
    <div data-analytics-view="cart_view" className="mb-6 rounded-2xl border border-line bg-bg-soft p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-xl">Ваш выбор</h3>
        <button type="button" disabled={checkoutPending} onClick={clear} className="text-xs text-muted underline underline-offset-4 hover:text-rose disabled:opacity-40">Очистить</button>
      </div>
      {(["bouquet", "flower", "packaging"] as const).map((kind) => {
        const lines = cart.filter((line) => catalog?.items.find((item) => item.id === line.id)?.kind === kind);
        if (!lines.length) return null;
        return <div key={kind} className="mt-5">
          <p className="eyebrow">{kind === "bouquet" ? "Готовые букеты" : kind === "flower" ? "Собрать из выбранных цветов" : "Упаковка"}</p>
          <ul className="mt-2 divide-y divide-line">
            {lines.map((line) => {
              const item = catalog!.items.find((candidate) => candidate.id === line.id)!;
              return <li key={line.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-muted">{item.priceKopecks === null ? "Цена уточняется" : `${formatKopecks(item.priceKopecks)} × ${line.quantity}`}</p>{line.quantity > item.available ? <p className="mt-1 text-xs text-rose">Доступно сейчас: {item.available}</p> : null}</div>
                <QuantityControl item={item} compact />
                <button type="button" disabled={checkoutPending} onClick={() => setQuantity(line.id, 0)} aria-label={`Удалить ${item.name}`} className="p-2 text-muted hover:text-rose disabled:opacity-40"><Trash size={18} /></button>
              </li>;
            })}
          </ul>
        </div>;
      })}
      {cart.filter((line) => !catalog?.items.some((item) => item.id === line.id)).map((line) => <div key={line.id} className="mt-3 flex items-center justify-between gap-3 text-sm text-rose"><span>Позиция больше недоступна · {line.quantity} шт.</span><button type="button" disabled={checkoutPending} onClick={() => setQuantity(line.id, 0)} className="underline disabled:opacity-40">Убрать</button></div>)}
      <div className="mt-4 flex items-center justify-between border-t border-line pt-4 font-semibold"><span>Стоимость выбранного</span><span className="tabular-nums">{formatKopecks(total)}</span></div>
      <p className="mt-2 text-xs leading-relaxed text-muted">Доставку и пожелания к оформлению согласуем отдельно. Флорист подтвердит наличие и закрепит цветы за вами.</p>
      {cartError && !checkoutPending ? <div role="status" className="mt-3 text-sm text-rose">{cartError} <button type="button" onClick={() => void refresh()} className="underline underline-offset-4">Обновить наличие</button></div> : null}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm text-muted">
        <Link href="/#bouquets" className="underline underline-offset-4 hover:text-rose">Добавить готовый букет</Link>
        <Link href="/flowers#flowers" className="underline underline-offset-4 hover:text-rose">Выбрать ещё цветы</Link>
      </div>
    </div>
  );
}
