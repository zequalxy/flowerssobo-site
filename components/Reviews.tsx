"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useReducedMotion,
} from "framer-motion";
import { Quotes, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { reviews } from "@/lib/reviews";
import { site } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";
import { TwoGisIcon } from "@/components/ui/TwoGisIcon";

/** Полный проход половины ленты, с — та же скорость, что у прежней CSS-анимации. */
const LOOP_DURATION = 48;

export function Reviews() {
  return (
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <Reveal>
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl">
              <p className="eyebrow">Отзывы</p>
              <h2 className="mt-4 text-balance text-4xl tracking-tight md:text-5xl">
                Нам доверяют важные моменты
              </h2>
            </div>
            <a
              href={site.twoGis}
              target="_blank"
              rel="noopener noreferrer"
              className="group inline-flex shrink-0 items-center gap-2.5 self-start rounded-full border border-line px-5 py-3 text-sm font-medium text-ink/80 transition-colors duration-200 hover:border-rose/60 hover:text-rose md:self-auto"
            >
              <TwoGisIcon size={18} />
              Читать все отзывы на 2ГИС
              <ArrowUpRight
                size={14}
                weight="bold"
                className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
          </div>
        </Reveal>
      </div>

      <ReviewsMarquee />
    </section>
  );
}

/**
 * Бесконечная лента: контент задублирован, позиция x держится в (-half, 0],
 * поэтому стык не виден. Автопрокрутка едет через requestAnimationFrame, а не
 * CSS-анимацию — так её можно перехватить рукой: drag мышью и свайп на тач-
 * экранах двигают ту же координату, после отпускания короткая инерция затухает
 * и авто продолжает с текущего места. Наведение мыши, как и раньше, ставит
 * ленту на паузу; reduced-motion отключает авто, но ручная прокрутка работает.
 */
function ReviewsMarquee() {
  const loop = [...reviews, ...reviews];
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const half = useRef(0);
  const drag = useRef<{ id: number; lastX: number; lastT: number } | null>(null);
  const hovering = useRef(false);
  const velocity = useRef(0); // сглаженная скорость пальца, px/s
  const momentum = useRef(0); // инерция после отпускания, px/s

  // Ширина половины ленты — пересчитываем при ресайзе/переносе карточек.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      half.current = el.scrollWidth / 2;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wrap = (val: number) => {
    const h = half.current;
    if (!h) return val;
    return -(((-val % h) + h) % h);
  };

  useAnimationFrame((_, delta) => {
    const h = half.current;
    if (!h || drag.current) return;
    const dt = Math.min(delta, 64) / 1000; // клампим скачок после ухода со вкладки
    const auto = h / LOOP_DURATION;

    if (momentum.current !== 0) {
      x.set(wrap(x.get() + momentum.current * dt));
      momentum.current *= Math.exp(-4 * dt);
      if (Math.abs(momentum.current) < auto) momentum.current = 0;
      return;
    }
    if (reduce || hovering.current) return;
    x.set(wrap(x.get() - auto * dt));
  });

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Capture может бросить, если указатель уже неактивен — drag всё равно работает.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    drag.current = { id: e.pointerId, lastX: e.clientX, lastT: performance.now() };
    velocity.current = 0;
    momentum.current = 0;
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const now = performance.now();
    const dx = e.clientX - d.lastX;
    const dt = (now - d.lastT) / 1000;
    x.set(wrap(x.get() + dx));
    if (dt > 0) velocity.current = velocity.current * 0.8 + (dx / dt) * 0.2;
    d.lastX = e.clientX;
    d.lastT = now;
  }

  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    const v = Math.max(-2400, Math.min(2400, velocity.current));
    momentum.current = Math.abs(v) > 120 ? v : 0;
  }

  return (
    <div
      className="relative mt-12 cursor-grab touch-pan-y select-none active:cursor-grabbing [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") hovering.current = true;
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") hovering.current = false;
      }}
    >
      <motion.div
        ref={trackRef}
        style={{ x }}
        className="flex w-max gap-4 px-2 md:gap-5"
      >
        {loop.map((r, i) => (
          <figure
            key={i}
            // Вторая половина — копия для бесшовного круга: скринридер
            // иначе зачитывал бы каждый отзыв дважды.
            aria-hidden={i >= reviews.length ? true : undefined}
            className="flex w-[300px] shrink-0 flex-col rounded-2xl border border-line bg-surface p-6 shadow-card sm:w-[360px]"
          >
            <Quotes size={26} weight="fill" className="text-rose/70" />
            <blockquote className="mt-4 flex-1 text-pretty text-sm leading-relaxed text-ink/85">
              {r.text}
            </blockquote>
            <figcaption className="mt-5 border-t border-line pt-4">
              <div className="font-display text-lg text-ink">{r.name}</div>
              <div className="mt-0.5 text-xs text-muted">{r.detail}</div>
            </figcaption>
          </figure>
        ))}
      </motion.div>
    </div>
  );
}
