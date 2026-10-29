import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Reveal } from "@/components/ui/Reveal";
import { SeasonVideo } from "@/components/SeasonVideo";

/**
 * Seasonality is the brand's core promise — this block sits first, above the
 * catalogue. A live "blooming now" badge + a strong lead drive the point home.
 */
export function Season() {
  return (
    <section id="season" className="relative scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-12 px-5 md:px-10 lg:grid-cols-2 lg:gap-20">
        {/* Video — витрина-холодильник студии; 4:5 кадрирует вертикальный ролик по центру */}
        <Reveal className="order-1">
          <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] border border-line-strong lg:max-w-none">
            <SeasonVideo
              src="/video/season.mp4"
              poster="/video/season-poster.jpg"
              label="Витрина Flowerssobo с сезонными цветами"
            />
            <div className="absolute left-4 top-4 flex items-center gap-2.5 rounded-full border border-white/15 bg-black/35 px-4 py-2.5 backdrop-blur-md">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-sage opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-sage" />
              </span>
              <span className="text-xs font-medium tracking-wide text-white/90">
                Цветёт прямо сейчас
              </span>
            </div>
          </div>
        </Reveal>

        {/* Content */}
        <div className="order-2">
          <Reveal>
            <p className="eyebrow">Сезон</p>
            <h2 className="mt-4 text-balance text-4xl tracking-tight md:text-5xl">
              То, что цветёт сейчас
            </h2>
            <p className="mt-6 max-w-xl text-balance text-lg font-medium leading-snug text-ink md:text-xl">
              Подборка недели
            </p>
            <p className="mt-5 max-w-xl text-pretty leading-relaxed text-muted">
              Мы работаем с сезоном, поэтому наша витрина постоянно меняется.
              Сейчас в ней хризантемы, подсолнухи, брассика, гортензии,
              ранункулюсы, амариллисы и ветки илекса.
            </p>
            <p className="mt-4 max-w-xl text-pretty leading-relaxed text-muted">
              Одни цветы остаются с нами всего несколько недель, другие
              появляются на витрине с наступлением своего сезона. Поэтому её
              состав меняется почти каждую неделю, а сезонные букеты редко
              получается повторить точь-в-точь.
            </p>
            <a
              href="#order"
              className="group mt-8 inline-flex items-center gap-2 text-sm font-semibold text-rose transition-colors hover:text-rose-deep"
            >
              Заказать сезонный букет
              <ArrowRight
                size={16}
                weight="bold"
                className="transition-transform group-hover:translate-x-0.5"
              />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
