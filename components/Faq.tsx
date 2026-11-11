"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Phone } from "@phosphor-icons/react/dist/ssr";
import { faqItems } from "@/lib/faq";
import { site } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";
import { cn } from "@/lib/utils";

const EASE: [number, number, number, number] = [0.23, 1, 0.32, 1];

/** Quiet flower mark — the same petals as the brand spinner, for atelier flair. */
function FlowerMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="currentColor" aria-hidden>
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
      <circle cx="24" cy="24" r="5" fill="currentColor" />
    </svg>
  );
}

/**
 * «Вопросы» — салонный аккордеон: крупная нумерация как графический акцент,
 * раскрытие по тапу (одно за раз). Те же тексты уходят в FAQPage-разметку.
 * Заменил прежнюю полосу преимуществ. Анимация сдержанная (height+opacity,
 * ease-out ≤280мс) — без перпетуальных лупов.
 */
export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };

  return (
    <section id="faq" data-analytics-view="faq_view" className="relative scroll-mt-24 bg-bg-soft py-24 md:py-32">
      {/* Static local data; "<" escaped per the Next.js JSON-LD recipe. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-5 md:px-10 lg:grid-cols-12 lg:gap-16">
        {/* Left — title block, sticky on desktop */}
        <Reveal className="lg:col-span-5">
          <div className="lg:sticky lg:top-28">
            <FlowerMark className="size-9 text-rose/70" />
            <p className="eyebrow mt-6">Вопросы и ответы</p>
            <h2 className="mt-4 text-balance text-4xl tracking-tight md:text-5xl">
              Коротко о главном
            </h2>
            <p className="mt-6 max-w-md text-pretty leading-relaxed text-muted">
              Собрали то, что чаще всего спрашивают перед заказом. Не нашли свой
              вопрос — флорист студии ответит лично.
            </p>
            <a
              href={site.phoneHref}
              data-analytics-event="phone_click"
              className="mt-8 inline-flex items-center gap-3 font-display text-2xl text-ink transition-colors hover:text-rose md:text-3xl"
            >
              <Phone size={22} weight="light" className="text-rose" />
              {site.phoneDisplay}
            </a>
          </div>
        </Reveal>

        {/* Right — accordion */}
        <Reveal delay={0.1} className="lg:col-span-7">
          <ul className="border-t border-line-strong">
            {faqItems.map((item, i) => {
              const active = open === i;
              return (
                <li key={item.q} className="border-b border-line-strong">
                  <button
                    type="button"
                    aria-expanded={active}
                    aria-controls={`faq-panel-${i}`}
                    onClick={() => setOpen(active ? null : i)}
                    className="group flex w-full items-start gap-4 py-6 text-left md:gap-6 md:py-7"
                  >
                    <span
                      className={cn(
                        "pt-0.5 font-display text-base tabular-nums tracking-tight transition-colors duration-200 md:text-lg",
                        active ? "text-rose" : "text-faint",
                      )}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span
                      className={cn(
                        "flex-1 font-display text-lg leading-snug tracking-tight transition-colors duration-200 md:text-xl",
                        active ? "text-rose" : "text-ink group-hover:text-rose",
                      )}
                    >
                      {item.q}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors duration-200",
                        active
                          ? "border-rose bg-rose text-white"
                          : "border-line-strong text-ink group-hover:border-rose group-hover:text-rose",
                      )}
                    >
                      <Plus
                        size={15}
                        weight="bold"
                        className={cn(
                          "transition-transform duration-300 ease-out",
                          active && "rotate-45",
                        )}
                      />
                    </span>
                  </button>

                  <AnimatePresence initial={false}>
                    {active ? (
                      <motion.div
                        key="content"
                        id={`faq-panel-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="overflow-hidden"
                      >
                        <p className="max-w-2xl pb-7 pl-10 pr-2 text-pretty leading-relaxed text-muted md:pl-[3.75rem]">
                          {item.a}
                        </p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
