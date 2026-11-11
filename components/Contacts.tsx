import {
  TelegramLogo,
  WhatsappLogo,
  InstagramLogo,
  Phone,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";
import { site } from "@/lib/site";
import { Reveal } from "@/components/ui/Reveal";
import { TwoGisIcon } from "@/components/ui/TwoGisIcon";

// «Написать нам» ведёт в личный диалог; канал остаётся в футере.
const messengers = [
  { icon: TelegramLogo, label: "Telegram", href: site.telegramChat, metric: "telegram_click" },
  { icon: WhatsappLogo, label: "WhatsApp", href: site.whatsapp },
  { icon: InstagramLogo, label: "Instagram", href: site.instagram, metric: "instagram_click" },
  { icon: TwoGisIcon, label: "2ГИС", href: site.twoGis },
];

export function Contacts() {
  return (
    <section id="contacts" data-analytics-view="contacts_view" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-5 md:px-10">
        <div className="grid grid-cols-1 gap-12 rounded-[2rem] border border-line bg-bg-elev/60 p-8 md:p-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="eyebrow">Контакты</p>
            <h2 className="mt-4 text-balance text-4xl tracking-tight md:text-5xl">
              Доставляем по Липецку каждый день
            </h2>
            <p className="mt-6 flex items-start gap-3 text-pretty leading-relaxed text-muted">
              <MapPin
                size={20}
                weight="light"
                className="mt-0.5 shrink-0 text-rose"
              />
              <span>
                Принимаем заявки ежедневно. Доставка по всему городу за 60–90
                минут — зону и стоимость уточнит флорист.
              </span>
            </p>

            {/* clamp + nowrap: номер не должен переноситься на узких экранах */}
            <a
              href={site.phoneHref}
              data-analytics-event="phone_click"
              className="mt-8 inline-flex items-center gap-3 whitespace-nowrap font-display text-[clamp(1.3rem,6vw,2.25rem)] text-ink transition-colors hover:text-rose"
            >
              <Phone size={26} weight="light" className="shrink-0 text-rose" />
              {site.phoneDisplay}
            </a>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="text-sm text-muted">Пишите, где удобно:</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {messengers.map((m) => (
                <a
                  key={m.label}
                  href={m.href}
                  data-analytics-event={m.metric}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-4 transition-colors duration-200 hover:border-rose/60 hover:bg-surface-hover"
                >
                  <m.icon
                    size={24}
                    weight="light"
                    className="text-ink/80 transition-colors group-hover:text-rose"
                  />
                  <span className="text-sm font-medium text-ink">
                    {m.label}
                    {m.label === "Instagram" ? (
                      <sup className="text-rose">*</sup>
                    ) : null}
                  </span>
                </a>
              ))}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-faint">
              * {site.metaDisclaimer}
            </p>

            <div className="mt-6 rounded-xl border border-line bg-surface p-5 text-xs leading-relaxed text-faint">
              {site.legal.entity}
              <br />
              ИНН {site.legal.inn} · ОГРНИП {site.legal.ogrnip}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
