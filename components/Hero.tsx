"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr";
import { Logo } from "@/components/ui/Logo";

/** Spinning flower mark for the preloader (petals olive, core sage). */
function FlowerSpinner() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-14 animate-flower-spin text-rose"
      fill="currentColor"
      aria-hidden
    >
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="24"
          cy="13"
          rx="5.5"
          ry="10"
          transform={`rotate(${a} 24 24)`}
        />
      ))}
      <circle cx="24" cy="24" r="5" className="text-sage" fill="currentColor" />
    </svg>
  );
}

export function Hero() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  // Автоплей хрупкий: iOS требует imperative muted, режим энергосбережения и
  // data-saver молча блокируют play(), а на медленной сети canplay может не
  // прийти долго. Поэтому: явный play() с повтором по первому тапу и возврату
  // на вкладку, страховочный таймаут прелоадера и одна перезагрузка при сбое.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    let retried = false;

    const done = () => setReady(true);
    const tryPlay = () => {
      v.play().catch(() => {
        /* autoplay заблокирован — постер остаётся, повторим по жесту */
      });
    };
    const onCanPlay = () => {
      done();
      if (v.paused) tryPlay();
    };
    const onError = () => {
      // Сетевой сбой: одна перезагрузка, дальше показываем постер.
      if (!retried) {
        retried = true;
        v.load();
        tryPlay();
      } else {
        done();
      }
    };
    const onFirstGesture = () => {
      if (v.paused) tryPlay();
    };
    const onVisible = () => {
      if (!document.hidden && v.paused) tryPlay();
    };

    if (v.readyState >= 3) onCanPlay();
    tryPlay();
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("error", onError);
    window.addEventListener("pointerdown", onFirstGesture);
    document.addEventListener("visibilitychange", onVisible);
    // Прелоадер не должен зависать на медленной сети — снимаем принудительно.
    const cap = window.setTimeout(done, 2500);

    return () => {
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("error", onError);
      window.removeEventListener("pointerdown", onFirstGesture);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(cap);
    };
  }, []);

  return (
    <section
      id="top"
      className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-ink"
    >
      {/* Размытая миниатюра ~7 КБ под видео — заполняет фон, пока грузится
          первый кадр, чтобы не мигать пустым цветом */}
      <div
        aria-hidden
        className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
        style={{ backgroundImage: "url(/video/hero-poster-blur.jpg)" }}
      />

      {/* src задан на самом <video>: у вложенного <source> событие error не
          всплывает на видео, и сбой загрузки раньше вешал прелоадер навсегда.
          object-cover на всех экранах: длинные телефоны (20:9) получают
          полноэкранное видео с лёгкой обрезкой по бокам вместо полос. */}
      <video
        ref={videoRef}
        aria-hidden
        src="/video/hero.mp4"
        className="absolute inset-0 size-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        poster="/video/hero-poster.jpg"
      />

      {/* Legibility scrim — keeps nav + overlay readable over the footage */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/15 to-black/55" />

      {/* Minimal overlay: brand wordmark + single CTA */}
      <div className="relative z-10 flex flex-col items-center px-6 text-center">
        {/* Единственный <h1> главной: визуально — только логотип, а
            поисковику и скринридеру — о чём сайт */}
        <h1 className="max-w-full">
          <Logo className="text-white text-[clamp(1.75rem,8.5vw,6rem)] drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]" />
          <span className="sr-only">
            {" "}
            — авторские букеты с доставкой по Липецку за 60–90 минут
          </span>
        </h1>

        <a
          href="#order"
          className="mt-10 inline-flex items-center justify-center rounded-full bg-white px-9 py-4 text-sm font-semibold uppercase tracking-[0.18em] text-rose shadow-[0_18px_50px_-20px_rgba(0,0,0,0.6)] transition-colors duration-200 hover:bg-bg-soft active:scale-[0.98]"
        >
          Заказать
        </a>
      </div>

      {/* Scroll cue */}
      <a
        href="#season"
        aria-label="Прокрутить вниз"
        className="absolute bottom-7 left-1/2 z-10 -translate-x-1/2 text-white/75 transition-colors hover:text-white"
      >
        <CaretDown size={26} weight="light" className="animate-bounce" />
      </a>

      {/* Preloader — flower spinner over white, fades out when the video is ready */}
      <div
        className={`absolute inset-0 z-20 flex items-center justify-center bg-bg transition-opacity duration-500 ${
          ready ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <FlowerSpinner />
      </div>
    </section>
  );
}
