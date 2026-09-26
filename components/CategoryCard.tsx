"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import type { Category } from "@/lib/catalog";
import { cn } from "@/lib/utils";

/**
 * Bento tile — full-bleed photo with the label overlaid on a dark scrim at the
 * bottom (blurb reveals on hover, desktop). The grid cell sets the size; the
 * image fills it via object-cover. Тап раскрывает карточку направления
 * (CategoryDetail) — на телефоне ховера нет, и описание иначе недоступно;
 * заказ оформляется уже оттуда.
 */
export function CategoryCard({
  category,
  className,
  onOpen,
  reduce,
}: {
  category: Category;
  className?: string;
  onOpen: (c: Category) => void;
  reduce: boolean | null;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(category)}
      aria-label={`${category.title} — подробнее`}
      layoutId={reduce ? undefined : `cat-${category.slug}`}
      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
      className={cn(
        "group relative h-full w-full overflow-hidden rounded-2xl border border-line bg-bg-elev text-left transition-transform duration-200 ease-out active:scale-[0.99]",
        className,
      )}
    >
      <Image
        src={category.image}
        alt={category.title}
        fill
        sizes={
          category.wide
            ? "(max-width: 1024px) 100vw, 1320px"
            : category.wideOnMobile
              ? "(max-width: 1024px) 100vw, 33vw"
              : "(max-width: 1024px) 50vw, 33vw"
        }
        style={{ objectPosition: category.objectPosition }}
        className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
      />

      {/* Legibility scrim */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent transition-opacity duration-500 group-hover:from-black/85" />

      {/* Overlaid caption */}
      <div className="absolute inset-x-0 bottom-0 p-3.5 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base leading-tight text-[#f6f1e8] md:text-2xl">
            {category.title}
          </h3>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-[#f6f1e8] transition-colors duration-300 group-hover:border-rose group-hover:bg-rose group-hover:text-white md:size-9">
            <ArrowUpRight size={14} weight="bold" />
          </span>
        </div>
        <p className="mt-2 hidden max-w-xs translate-y-2 text-sm leading-snug text-[#f6f1e8]/70 opacity-0 transition-all duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 md:block">
          {category.blurb}
        </p>
      </div>
    </motion.button>
  );
}
