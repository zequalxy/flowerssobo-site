"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { X, ArrowRight, Flower } from "@phosphor-icons/react/dist/ssr";
import { formatKopecks, type StorefrontItem } from "@/lib/storefront";
import { selectable, useStorefront } from "./StorefrontProvider";

export function ProductDetail({ product, onClose, reduce }: {
  product: StorefrontItem;
  onClose: () => void;
  reduce: boolean | null;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const { state, cart, setQuantity, checkoutPending } = useStorefront();
  const chosen = cart.find((line) => line.id === product.id)?.quantity ?? 0;
  const canAdd = !checkoutPending && selectable(product, state === "ready") && chosen < product.available;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]');
      if (!buttons?.length) { event.preventDefault(); return; }
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, [onClose]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <motion.div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="bouquet-title" tabIndex={-1}
        layoutId={reduce ? undefined : `card-${product.id}`} initial={reduce ? { opacity: 0 } : false} animate={reduce ? { opacity: 1 } : undefined}
        transition={{ type: "spring", bounce: 0.18, duration: 0.5 }}
        className="pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-x-hidden overflow-y-auto rounded-t-[1.75rem] border border-line bg-bg-elev shadow-[0_-20px_60px_-30px_rgba(0,0,0,0.8)] outline-none md:max-h-[88dvh] md:w-[min(94vw,430px)] md:rounded-[1.75rem]"
      >
        <div className="sticky top-0 z-20 h-0"><button type="button" onClick={onClose} aria-label="Закрыть" className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md"><X size={18} weight="bold" /></button></div>
        <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden bg-bg-soft">
          {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill unoptimized sizes="(max-width: 768px) 100vw, 430px" className="object-cover" /> : <div className="flex h-full items-center justify-center text-rose/40"><Flower size={96} weight="light" /></div>}
        </div>
        <div className="flex flex-col p-6">
          <p className="eyebrow">Готовый букет · на фото именно он</p>
          <div className="mt-3 flex items-start justify-between gap-3"><h3 id="bouquet-title" className="font-display text-2xl tracking-tight text-ink">{product.name}</h3><span className="shrink-0 rounded-full bg-rose/15 px-3 py-1.5 text-sm font-semibold text-rose tabular-nums">{product.priceKopecks === null ? "Цена уточняется" : formatKopecks(product.priceKopecks)}</span></div>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted">{product.description}</p>
          {product.composition.length > 0 ? <div className="mt-5"><p className="eyebrow">Состав</p><div className="mt-2.5 flex flex-wrap gap-2">{product.composition.map((part) => <span key={part.productId} className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink/85">{part.name} · {part.quantity}</span>)}</div></div> : null}
          <div className="sticky bottom-0 -mx-6 -mb-6 mt-7 border-t border-line bg-bg-elev px-6 pb-6 pt-4">
            <button type="button" disabled={!canAdd} onClick={() => { setQuantity(product.id, chosen + 1); onClose(); }} className="flex w-full items-center justify-center gap-2 rounded-full bg-rose px-6 py-4 text-sm font-semibold text-white transition-colors hover:bg-rose-deep disabled:cursor-not-allowed disabled:opacity-50">
              {checkoutPending ? "Проверяем отправленную заявку" : state !== "ready" ? "Наличие уточняется" : product.available === 0 ? "Букет сейчас недоступен" : chosen >= product.available && chosen > 0 ? "Уже в вашем выборе" : "Добавить к выбору"}<ArrowRight size={18} weight="bold" />
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-faint">Флорист подтвердит наличие и согласует доставку или самовывоз.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
