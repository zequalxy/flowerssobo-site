"use client";

import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from "framer-motion";
import {
  WhatsappLogo,
  TelegramLogo,
  Phone,
} from "@phosphor-icons/react/dist/ssr";
import { site } from "@/lib/site";
import { useStorefront } from "./StorefrontProvider";

const actions = [
  { icon: WhatsappLogo, href: site.whatsapp, label: "Написать в WhatsApp" },
  // Личный диалог (не канал) — виджет = «написать нам».
  { icon: TelegramLogo, href: site.telegramChat, label: "Написать в Telegram", metric: "telegram_click" },
  { icon: Phone, href: site.phoneHref, label: "Позвонить", metric: "phone_click" },
];

export function FloatingContacts() {
  const { cart } = useStorefront();
  const [visible, setVisible] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => {
    setVisible(v > 640);
  });

  // После reload посреди страницы scroll-событие не приходит — инициализируем.
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(window.scrollY > 640));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className={`fixed right-5 z-40 flex flex-col gap-3 md:right-7 ${cart.length ? "bottom-24 md:bottom-28" : "bottom-5 md:bottom-7"}`}>
      <AnimatePresence>
        {visible &&
          actions.map((a, i) => (
            <motion.a
              key={a.label}
              href={a.href}
              data-analytics-event={a.metric}
              target={a.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              aria-label={a.label}
              initial={{ opacity: 0, scale: 0.6, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 12 }}
              transition={{
                duration: 0.25,
                ease: [0.23, 1, 0.32, 1],
                delay: i * 0.04,
              }}
              whileTap={{ scale: 0.92 }}
              className="flex size-12 items-center justify-center rounded-full border border-line-strong bg-bg-elev/90 text-ink backdrop-blur-md transition-colors duration-200 hover:bg-rose hover:text-white hover:border-rose md:size-14"
            >
              <a.icon size={24} weight="light" />
            </motion.a>
          ))}
      </AnimatePresence>
    </div>
  );
}

