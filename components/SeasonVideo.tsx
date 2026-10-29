"use client";

import { useEffect, useRef } from "react";

/**
 * Видео витрины для блока «Сезон». Блок ниже первого экрана, поэтому ролик
 * не грузится заранее (preload="none") и не спорит за сеть с hero-видео:
 * play() — когда блок попал в кадр, pause() — когда ушёл. При
 * prefers-reduced-motion и data-saver остаётся постер (первый кадр).
 */
export function SeasonVideo({
  src,
  poster,
  label,
}: {
  src: string;
  poster: string;
  label: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const saveData = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection?.saveData;
    if (
      saveData ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    // iOS требует muted, выставленный императивно, иначе play() отклоняется.
    v.muted = true;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          v.play().catch(() => {
            /* автоплей заблокирован — остаётся постер */
          });
        } else {
          v.pause();
        }
      },
      // Без запаса по rootMargin: блок стоит сразу под первым экраном, и
      // запас заставлял качать ролик на загрузке, вместе с hero-видео.
      // Постер = первый кадр, поэтому старт с задержкой незаметен.
      { threshold: 0.2 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      aria-label={label}
      muted
      loop
      playsInline
      preload="none"
      className="absolute inset-0 size-full object-cover"
    />
  );
}
