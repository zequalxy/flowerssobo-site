import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { site } from "@/lib/site";
import "./globals.css";

const onest = Onest({
  subsets: ["latin", "cyrillic"],
  variable: "--font-onest",
  display: "swap",
});

// Logo wordmark only (Latin caps "FLOWERSSOBO").
const daysSans = localFont({
  src: "./fonts/DaysSansBlack.otf",
  variable: "--font-days",
  display: "swap",
  weight: "900",
});

const SITE_URL = site.url;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Flowerssobo — доставка цветов в Липецке за 60–90 минут",
    template: "%s · Flowerssobo",
  },
  description:
    "Авторские букеты, монобукеты, композиции и редкие растения с доставкой по Липецку за 60–90 минут. Контроль свежести каждого цветка. Оставьте заявку — соберём под ваш повод.",
  keywords: [
    "доставка цветов Липецк",
    "букеты Липецк",
    "флористика",
    "монобукет",
    "композиции из цветов",
    "Flowerssobo",
  ],
  openGraph: {
    title: "Flowerssobo — доставка цветов в Липецке за 60–90 минут",
    description:
      "Авторские букеты и редкие растения с доставкой по Липецку за 60–90 минут. Контроль свежести каждого цветка.",
    url: SITE_URL,
    siteName: "Flowerssobo",
    locale: "ru_RU",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630 }],
  },
  alternates: { canonical: SITE_URL },
};

/** Карточка организации для локального поиска («доставка цветов липецк»). */
const floristJsonLd = {
  "@context": "https://schema.org",
  "@type": "Florist",
  name: site.name,
  url: SITE_URL,
  image: `${SITE_URL}/og.jpg`,
  telephone: site.phoneHref.replace("tel:", ""),
  description:
    "Авторские букеты из сезонных цветов с доставкой по Липецку за 60–90 минут. Заявки принимаем круглосуточно.",
  address: {
    "@type": "PostalAddress",
    addressLocality: site.city,
    addressCountry: "RU",
  },
  areaServed: site.city,
  openingHoursSpecification: {
    "@type": "OpeningHoursSpecification",
    dayOfWeek: [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ],
    opens: "09:00",
    closes: "21:00",
  },
  sameAs: [site.telegram, site.instagram, site.twoGis],
  priceRange: "₽₽",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${onest.variable} ${daysSans.variable}`}>
      <body className="font-sans antialiased">
        {/* Static local data; "<" escaped per the Next.js JSON-LD recipe. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(floristJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "var(--color-bg-elev)",
              border: "1px solid var(--color-line-strong)",
              color: "var(--color-ink)",
              fontFamily: "var(--font-onest), system-ui, sans-serif",
            },
          }}
        />
      </body>
    </html>
  );
}
