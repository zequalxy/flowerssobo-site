"use client";

import { useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { X, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Category } from "@/lib/catalog";

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

/**
 * Раскрытая карточка направления каталога: то же фото и то же микроописание,
 * что показывалось на десктопе по ховеру — на телефоне до него было не
 * добраться. Морф в/из плитки идёт через общий `layoutId` с CategoryCard
 * (подложку рисует Categories). CTA префилит форму заявки и ведёт к ней.
 */
export function CategoryDetail({
  category,
  onClose,
  reduce,
}: {
  category: Category;
  onClose: () => void;
  reduce: boolean | null;
}) {
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
      new CustomEvent("flowerssobo:prefill", { detail: category.formValue }),
    );
    onClose();
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={category.title}
      className="pointer-events-none fixed inset-0 z-[80] flex items-end justify-center md:items-center md:p-6"
    >
      <motion.div
        layoutId={reduce ? undefined : `cat-${category.slug}`}
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

        {/* Отдельный кадр 4:5, скадрированный по композиции: плиточный кроп
            бенто здесь не годится — в карточку заходят рассмотреть букет. */}
        <div className="relative aspect-[4/5] w-full shrink-0 overflow-hidden">
          <Image
            src={category.detailImage}
            alt={category.title}
            fill
            sizes="(max-width: 768px) 100vw, 430px"
            className="object-cover"
          />
        </div>

        {/* Текст проявляется, когда морф уже сел на место */}
        <motion.div
          className="flex flex-col p-6"
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduce ? 0 : 0.16, duration: 0.4, ease: EASE }}
        >
          <h3 className="font-display text-2xl tracking-tight text-ink">
            {category.title}
          </h3>
          <p className="mt-3 text-pretty leading-relaxed text-muted">
            {category.blurb}
          </p>

          <button
            type="button"
            onClick={order}
            className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-rose px-6 py-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-rose-deep active:scale-[0.99]"
          >
            Заказать такой букет
            <ArrowRight size={18} weight="bold" />
          </button>
          <p className="mt-3 text-center text-xs leading-relaxed text-faint">
            Соберём под ваш повод, бюджет и пожелания
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
