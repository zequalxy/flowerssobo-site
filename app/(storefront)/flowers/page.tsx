import type { Metadata } from "next";
import { FlowerShowcase } from "@/components/FlowerShowcase";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Собрать свой букет — цветы поштучно в Липецке",
  description: "Выберите любимые цветы поштучно, количество и упаковку. Флорист Flowerssobo подтвердит наличие, соберёт букет и согласует доставку по Липецку.",
  alternates: { canonical: `${site.url}/flowers` },
  openGraph: {
    title: "Собрать свой букет · Flowerssobo",
    description: "Цветы поштучно из витрины студии. Выберите состав и оформление — флорист поможет с остальным.",
    url: `${site.url}/flowers`,
    siteName: site.name,
    locale: "ru_RU",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630 }],
  },
};

export default function FlowersPage() {
  return <FlowerShowcase />;
}
