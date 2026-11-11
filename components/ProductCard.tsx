"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowUpRight, Flower } from "@phosphor-icons/react/dist/ssr";
import { formatKopecks, type StorefrontItem } from "@/lib/storefront";

export function ProductCard({ product, onOpen, reduce, ready }: {
  product: StorefrontItem;
  onOpen: (product: StorefrontItem) => void;
  reduce: boolean | null;
  ready: boolean;
}) {
  const available = ready && product.available > 0;
  return (
    <motion.button
      type="button" onClick={() => onOpen(product)}
      data-analytics-event="bouquet_open"
      aria-label={`${product.name} — ${product.priceKopecks === null ? "цена уточняется" : formatKopecks(product.priceKopecks)}`}
      layout={!reduce} layoutId={reduce ? undefined : `card-${product.id}`}
      initial={reduce ? false : { opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ layout: { type: "spring", bounce: 0.2, duration: 0.5 }, duration: 0.3 }}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-bg-elev text-left transition-shadow duration-300 hover:shadow-card"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-bg-soft">
        {product.imageUrl ? <Image src={product.imageUrl} alt={product.name} fill unoptimized sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" /> : <div className="flex h-full items-center justify-center text-rose/40"><Flower size={72} weight="light" /></div>}
        <span className="absolute left-3 top-3 rounded-full bg-bg/85 px-2.5 py-1 text-[11px] font-medium text-ink backdrop-blur-sm">
          {!ready ? "Наличие уточняется" : available ? "Уже собран" : "Сейчас недоступен"}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3 md:p-4">
        <h3 className="font-display text-sm font-semibold leading-tight tracking-tight text-ink md:text-base">{product.name}</h3>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tabular-nums text-ink md:text-base">{product.priceKopecks === null ? "Цена уточняется" : formatKopecks(product.priceKopecks)}</span>
          <span className="flex size-8 items-center justify-center rounded-full border border-line text-ink transition-colors duration-300 group-hover:border-rose group-hover:bg-rose group-hover:text-white"><ArrowUpRight size={15} weight="bold" /></span>
        </div>
      </div>
    </motion.button>
  );
}
