import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { site } from "@/lib/site";

/**
 * Общая обёртка правовых страниц (/privacy, /consent): лёгкая шапка без
 * якорей главной, заголовок с датой редакции, типографика текста и
 * реквизиты оператора внизу.
 */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-[100dvh]">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[760px] items-center justify-between px-5 md:h-20 md:px-10">
          <Link
            href="/"
            className="font-display text-xl tracking-tight text-ink md:text-2xl"
          >
            Flowerssobo
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft size={16} weight="bold" />
            На главную
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-5 py-16 md:px-10 md:py-24">
        <p className="eyebrow">Правовая информация</p>
        <h1 className="mt-4 text-balance text-4xl tracking-tight md:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-sm text-faint">
          Редакция от {site.privacyRevision}
        </p>

        <div className="mt-12 flex flex-col gap-10 text-pretty leading-relaxed text-muted [&_a]:text-ink [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-rose [&_h2]:font-display [&_h2]:text-2xl [&_h2]:tracking-tight [&_h2]:text-ink [&_li]:mt-2 [&_p]:mt-4 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>

        <div className="mt-16 border-t border-line pt-6 text-xs leading-relaxed text-faint">
          {site.legal.entity} · ИНН {site.legal.inn} · ОГРНИП{" "}
          {site.legal.ogrnip} · {site.city}
          <br />
          Телефон для обращений:{" "}
          <a
            href={site.phoneHref}
            className="text-ink underline underline-offset-2 hover:text-rose"
          >
            {site.phoneDisplay}
          </a>
        </div>
      </main>
    </div>
  );
}
