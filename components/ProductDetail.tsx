"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { X, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { type Product, formatPrice, stemTotal } from "@/lib/products";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

/**
 * Expanded bouquet card. Mounted only while a product is selected; the morph
 * in/out is driven by the shared `layoutId` with ProductCard (the backdrop is
 * rendered/animated by Showcase). On mobile it reads as a bottom sheet, on
 * desktop as a centered card. CTA pre-fills the order form via the
 * `flowerssobo:prefill` event and scrolls to it.
 */
export function ProductDetail({
  product,
  onClose,
  reduce,
}: {
  product: Product;
  onClose: () => void;
  reduce: boolean | null;
}) {
  const stems = product.stems;
  // Стартуем с количества на фото, чтобы цена совпадала с тем, что видишь.
  const [qty, setQty] = useState(
    stems ? (stems.photoCount ?? stems.options[0]) : 0,
  );
  const total = stems ? stemTotal(stems, qty) : product.price;

  // Lock body scroll + close on Escape while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function order() {
    window.dispatchEvent(
      new CustomEvent("flowerssobo:prefill", {
        detail: {
          category: product.formCategory,
          comment: stems
            ? `Букет из витрины: «${product.name}», ${qty} шт (${formatPrice(total)})`
            : `Букет из витрины: «${product.name}» (${formatPrice(total)})`,
        },
      }),
    );
    onClose();
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6">
      <motion.div
        layoutId={reduce ? undefined : `card-${product.slug}`}
        initial={reduce ? { opacity: 0, y: 16 } : false}
        animate={reduce ? { opacity: 1, y: 0 } : undefined}
        transition={
          reduce
            ? { duration: 0.25, ease: EASE }
            : { type: "spring", bounce: 0.18, duration: 0.5 }
        }
        className="pointer-events-auto flex max-h-[92dvh] w-full flex-col overflow-x-hidden overflow-y-auto rounded-t-[1.75rem] border border-line bg-bg-elev shadow-[0_-20px_60px_-30px_rgba(0,0,0,0.8)] md:max-h-[88dvh] md:w-[min(94vw,430px)] md:rounded-[1.75rem] md:shadow-[0_40px_90px_-40px_rgba(0,0,0,0.85)]"
      >
        {/* Нулевой по высоте липкий слой: крестик не уезжает при прокрутке */}
        <div className="sticky top-0 z-20 h-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md transition-colors hover:bg-black/55 active:scale-95"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        {/* Фото 4:5, заранее скадрированное по композиции (public/images/detail/)
            — окно того же формата, поэтому кадр ложится один в один. */}
        <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(max-width: 768px) 100vw, 430px"
            className="object-cover"
          />
        </div>

        {/* Content — fades up after the morph settles */}
        <motion.div
          className="flex flex-col p-6"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.16, duration: 0.4, ease: EASE }}
        >
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-2xl tracking-tight text-ink">
              {product.name}
            </h3>
            <span className="shrink-0 rounded-full bg-rose/15 px-3 py-1.5 text-sm font-semibold text-rose tabular-nums">
              {formatPrice(total)}
            </span>
          </div>

          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted">
            {product.description}
          </p>

          {stems ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
                Количество
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {stems.options.map((n) => {
                  const active = n === qty;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setQty(n)}
                      aria-pressed={active}
                      className={cn(
                        "relative min-w-12 rounded-full border px-3.5 py-2 text-sm font-medium tabular-nums transition-colors duration-200 active:scale-[0.97]",
                        active
                          ? "border-rose/50 text-ink"
                          : "border-line text-muted hover:text-ink",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="qty-pill"
                          className="absolute inset-0 -z-10 rounded-full bg-rose/15"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                        />
                      ) : null}
                      {n}
                    </button>
                  );
                })}
              </div>
              {stems.photoCount ? (
                <p className="mt-2.5 text-xs text-faint">
                  На фото — {stems.photoCount} шт
                </p>
              ) : null}
            </div>
          ) : null}

          {product.flowers.length > 0 ? (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
                Состав
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {product.flowers.map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink/85"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Кнопка прилипает к низу карточки: фото 4:5 крупное, и без этого
              на телефоне заказ уезжал бы за край экрана */}
          <div className="sticky bottom-0 -mx-6 -mb-6 mt-7 border-t border-line bg-bg-elev px-6 pb-6 pt-4">
            <button
              type="button"
              onClick={order}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-rose px-6 py-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-rose-deep active:scale-[0.99]"
            >
              Заказать этот букет
              <ArrowRight size={18} weight="bold" />
            </button>
            <p className="mt-3 text-center text-xs leading-relaxed text-faint">
              Флорист подтвердит наличие и соберёт под ваш повод
            </p>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
