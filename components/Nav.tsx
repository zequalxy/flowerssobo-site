"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import { List, X, Phone } from "@phosphor-icons/react/dist/ssr";
import { navLinks, site } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/utils";

const DRAWER_EASE: [number, number, number, number] = [0.32, 0.72, 0, 1];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => {
    setScrolled(v > 28);
  });

  // При reload посреди страницы (браузер восстанавливает позицию) scroll-событие
  // не приходит — без этого хедер оставался прозрачным до первого скролла.
  useEffect(() => {
    const id = requestAnimationFrame(() => setScrolled(window.scrollY > 28));
    return () => cancelAnimationFrame(id);
  }, []);

  // Открытое меню: фон не должен прокручиваться, Escape закрывает.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
          scrolled
            ? "border-b border-line bg-bg/80 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <nav className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-5 md:h-20 md:px-10">
          <a href="#top" aria-label="Flowerssobo — наверх">
            <Logo
              className={cn(
                "text-xl transition-colors duration-300 md:text-2xl",
                scrolled ? "text-rose" : "text-white",
              )}
            />
          </a>

          <ul className="hidden items-center gap-9 lg:flex">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={cn(
                    "text-sm transition-colors duration-200",
                    scrolled
                      ? "text-muted hover:text-ink"
                      : "text-white/80 hover:text-white",
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-5 lg:flex">
            <a
              href={site.phoneHref}
              className={cn(
                "text-sm font-medium transition-colors duration-200",
                scrolled
                  ? "text-ink/90 hover:text-rose"
                  : "text-white/90 hover:text-white",
              )}
            >
              {site.phoneDisplay}
            </a>
            <a
              href="#order"
              className="rounded-full bg-rose px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-rose-deep active:scale-[0.97]"
            >
              Оставить заявку
            </a>
          </div>

          <button
            type="button"
            aria-label="Открыть меню"
            onClick={() => setOpen(true)}
            className={cn(
              "flex size-11 items-center justify-center rounded-full border transition-colors lg:hidden",
              scrolled
                ? "border-line text-ink hover:bg-surface-hover"
                : "border-white/30 text-white hover:bg-white/10",
            )}
          >
            <List size={22} weight="light" />
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Меню"
            className="fixed inset-0 z-[60] flex flex-col bg-bg/95 backdrop-blur-2xl lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex h-16 items-center justify-between px-5">
              <Logo className="text-xl text-rose" />
              <button
                type="button"
                aria-label="Закрыть меню"
                onClick={() => setOpen(false)}
                className="flex size-11 items-center justify-center rounded-full border border-line text-ink transition-colors hover:bg-surface-hover"
              >
                <X size={22} weight="light" />
              </button>
            </div>

            <nav className="flex flex-1 flex-col justify-center gap-2 px-6">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.08 + i * 0.05,
                    duration: 0.4,
                    ease: DRAWER_EASE,
                  }}
                  className="border-b border-line py-4 font-display text-3xl font-bold tracking-tight text-ink"
                >
                  {link.label}
                </motion.a>
              ))}
            </nav>

            <div className="flex flex-col gap-3 px-6 pb-10">
              <a
                href={site.phoneHref}
                className="flex items-center gap-3 text-lg text-ink"
              >
                <Phone size={20} weight="light" className="text-rose" />
                {site.phoneDisplay}
              </a>
              <a
                href="#order"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full bg-rose px-6 py-4 text-center text-base font-semibold text-white active:scale-[0.98]"
              >
                Оставить заявку
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
