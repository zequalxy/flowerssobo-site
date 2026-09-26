import {
  TelegramLogo,
  WhatsappLogo,
  InstagramLogo,
  Megaphone,
} from "@phosphor-icons/react/dist/ssr";
import { navLinks, site } from "@/lib/site";
import { Logo } from "@/components/ui/Logo";
import { TwoGisIcon } from "@/components/ui/TwoGisIcon";

/**
 * Соцссылки — подписанные пилюли, чтобы канал и личный диалог Telegram
 * не путались: самолётик = написать нам, мегафон = канал с работами.
 */
const socials = [
  { icon: TelegramLogo, href: site.telegramChat, label: "Написать в Telegram" },
  { icon: Megaphone, href: site.telegram, label: "Telegram-канал" },
  { icon: WhatsappLogo, href: site.whatsapp, label: "WhatsApp" },
  { icon: InstagramLogo, href: site.instagram, label: "Instagram", star: true },
  { icon: TwoGisIcon, href: site.twoGis, label: "2ГИС" },
];

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo className="text-2xl text-rose" />
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Авторская флористика и доставка цветов по Липецку за 60–90 минут.
            </p>
          </div>

          <nav className="flex flex-col gap-3">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-muted transition-colors hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex max-w-sm flex-col gap-4">
            <a
              href={site.phoneHref}
              className="font-display text-2xl text-ink transition-colors hover:text-rose"
            >
              {site.phoneDisplay}
            </a>
            <div className="flex flex-wrap gap-2">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm text-ink/80 transition-colors duration-200 hover:border-rose/60 hover:text-rose"
                >
                  <s.icon size={17} weight="light" />
                  <span>
                    {s.label}
                    {s.star ? <sup className="text-rose">*</sup> : null}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-xs text-faint md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} Flowerssobo · {site.legal.entity}
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-5">
            <a href="/privacy" className="transition-colors hover:text-ink">
              Положение о конфиденциальности
            </a>
            <a href="/consent" className="transition-colors hover:text-ink">
              Согласие на обработку ПДн
            </a>
            <p>
              ИНН {site.legal.inn} · ОГРНИП {site.legal.ogrnip}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[11px] leading-relaxed text-faint">
          * {site.metaDisclaimer}
        </p>
      </div>
    </footer>
  );
}
