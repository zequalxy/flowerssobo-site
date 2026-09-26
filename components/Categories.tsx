"use client";

import { useCallback, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { categories, type Category } from "@/lib/catalog";
import { CategoryCard } from "@/components/CategoryCard";
import { CategoryDetail } from "@/components/CategoryDetail";
import { Reveal } from "@/components/ui/Reveal";

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

/**
 * Tile placement per slug. Mobile (2 cols) flows in DOM order with the two tall
 * photos (giant, wedding) spanning two rows and the jute + business banners
 * full-width at the bottom. Desktop (lg, 3 cols) pins each tile to an explicit
 * cell — a composed 3×3 collage (mono · giant(tall) · trend / custom · giant ·
 * wedding(tall) / interior · jute · wedding), with the B2B banner spanning all
 * three columns on a fourth row below.
 *
 * ВАЖНО: высоких плиток на мобильном должно быть ЧЁТНОЕ число — при нечётном
 * в сетке из двух колонок остаётся пустая клетка.
 *
 * Котомка на мобильном — баннер во всю ширину В ДВА РЯДА. В один ряд (168px)
 * при ширине 350px в кадр влезает лишь 86% композиции, и цветы или котомка
 * неминуемо режутся; обрезать сам файл бесполезно — узкий исходник в широкой
 * плитке масштабируется крупнее и режется ещё сильнее.
 */
const layout: Record<string, string> = {
  mono: "lg:col-start-1 lg:row-start-1",
  giant: "row-span-2 lg:col-start-2 lg:row-start-1",
  trend: "lg:col-start-3 lg:row-start-1",
  custom: "lg:col-start-1 lg:row-start-2",
  wedding: "row-span-2 lg:col-start-3 lg:row-start-2",
  interior: "lg:col-start-1 lg:row-start-3",
  jute: "col-span-2 row-span-2 lg:col-span-1 lg:row-span-1 lg:col-start-2 lg:row-start-3",
  business: "col-span-2 lg:col-span-3 lg:col-start-1 lg:row-start-4",
};

export function Categories() {
  const reduce = useReducedMotion();
  const [selected, setSelected] = useState<Category | null>(null);

  const close = useCallback(() => setSelected(null), []);

  return (
    <section id="catalog" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Каталог</p>
              <h2 className="mt-4 max-w-xl text-balance text-4xl tracking-tight md:text-5xl">
                Букет под каждый повод и настроение
              </h2>
            </div>
            <p className="max-w-sm text-pretty leading-relaxed text-muted">
              Выберите направление — соберём букет с нуля из свежих цветов,
              учтём повод и ваши пожелания.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-12 grid auto-rows-[10.5rem] grid-cols-2 gap-3 sm:auto-rows-[12.5rem] lg:auto-rows-[15rem] lg:grid-cols-3 lg:gap-4">
            {categories.map((c) => (
              <CategoryCard
                key={c.slug}
                category={c}
                className={layout[c.slug]}
                onOpen={setSelected}
                reduce={reduce}
              />
            ))}
          </div>
        </Reveal>
      </div>

      {/* Подложка гаснет отдельно, чтобы карточка успела сморфиться обратно */}
      <AnimatePresence>
        {selected ? (
          <motion.div
            key="category-backdrop"
            onClick={close}
            className="fixed inset-0 z-[75] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {selected ? (
          <CategoryDetail
            key={selected.slug}
            category={selected}
            onClose={close}
            reduce={reduce}
          />
        ) : null}
      </AnimatePresence>
    </section>
  );
}
