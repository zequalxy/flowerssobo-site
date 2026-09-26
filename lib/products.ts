/**
 * Витрина — позиции с ценой за штуку и выбором количества (данные владельца,
 * июль 2026). Фото живут в /public/images/products. Позиции с `stems`
 * продаются поштучно: в карточке селектор количества, цена = кол-во × цена
 * за штуку, `price` заполняется автоматически минимальным вариантом. Сборные
 * букеты идут без `stems` с фиксированной ценой. Прежняя витрина с
 * фикс-ценами лежит в lib/products-archive.ts — вернуть можно одной строкой.
 */
export type StemPricing = {
  /** Цена за штуку (стебель или ветку), ₽. На сайте не показывается. */
  perStem: number;
  /** Варианты количества в селекторе, по возрастанию. */
  options: number[];
  /** Сколько штук на фото карточки — выводим подпись «на фото — N шт». */
  photoCount?: number;
  /**
   * Доплата за упаковку по выбранному количеству, ₽ (коробка L/XL и т.п.).
   * Молча входит в итоговую цену — отдельной строкой не показывается.
   */
  packaging?: Record<number, number>;
};

export type RawProduct = {
  slug: string;
  name: string;
  description: string;
  flowers: string[];
  /** Фиксированная цена сборного; у поштучных не задаётся. */
  price?: number;
  stems?: StemPricing;
  /** Pre-fills the order form's category when «Заказать» is pressed. */
  formCategory: string;
  /**
   * Фото 4:5, уже скадрированное по композиции (public/images/detail/) —
   * и плитка витрины, и раскрытая карточка тоже 4:5, так что кадр совпадает
   * один в один. Исходники без кропа лежат в public/images/products/.
   */
  image: string;
  /** CSS object-position — нужен только для нескадрированных (архивных) фото. */
  imagePosition?: string;
};

export type Product = Omit<RawProduct, "price"> & {
  /** Фикс-цена сборного или минимальный вариант поштучного. */
  price: number;
};

const raw: RawProduct[] = [
  {
    slug: "kustovaya-roza-mix",
    name: "Кустовая роза",
    description:
      "Розово-кремовый микс кустовой розы с пионовидными бутонами — плотный, многослойный объём. Количество веток выбираете сами.",
    flowers: ["Кустовая роза"],
    stems: { perStem: 458, options: [9, 15, 19, 25, 51, 101] },
    formCategory: "Монобукет",
    image: "/images/detail/kustovaya-roza-mix.jpg",
  },
  {
    slug: "eustoma-belaya",
    name: "Эустома",
    description:
      "Пышный моно из белой эустомы — лёгкий, ажурный и очень деликатный. Каждая ветка даёт несколько раскрытых бутонов.",
    flowers: ["Эустома"],
    stems: { perStem: 398, options: [9, 11, 15, 19, 25], photoCount: 19 },
    formCategory: "Монобукет",
    image: "/images/detail/eustoma-belaya.jpg",
  },
  {
    slug: "krasnaya-roza",
    name: "Красная роза",
    description:
      "Классический моно из красных роз: плотная сборка и насыщенный цвет. Подходит к любому поводу и просто без повода.",
    flowers: ["Красная роза"],
    stems: { perStem: 260, options: [9, 15, 19, 25, 51, 101], photoCount: 25 },
    formCategory: "Монобукет",
    image: "/images/detail/krasnaya-roza.jpg",
  },
  {
    slug: "gortenziya-sad-roza",
    name: "Гортензия и садовая роза",
    description:
      "Сборный букет из голубой гортензии, ароматной маттиолы и пионовидной садовой розы — пастельный, объёмный и нежный.",
    flowers: ["Гортензия", "Маттиола", "Садовая роза"],
    price: 10000,
    formCategory: "Кастомный букет",
    image: "/images/detail/gortenziya-sad-roza.jpg",
  },
  {
    slug: "mattiola-belaya",
    name: "Маттиола",
    description:
      "Ароматный моно из белой маттиолы — воздушные соцветия и тот самый густой сладкий запах, который заполняет комнату.",
    flowers: ["Маттиола"],
    stems: { perStem: 388, options: [9, 11, 15, 21, 25] },
    formCategory: "Монобукет",
    image: "/images/detail/mattiola-belaya.jpg",
  },
  {
    slug: "roza-51-korobka",
    name: "Роза в коробке",
    description:
      "Нежно-розовые розы в фирменной коробке с ручкой — готовый жест-впечатление, который удобно нести и не нужно ставить в вазу сразу. Коробку подберём под количество.",
    flowers: ["Роза"],
    stems: {
      perStem: 298,
      options: [15, 19, 25, 29, 33, 51],
      photoCount: 51,
      // 15–25 шт — коробка L (+360 ₽), 29–51 шт — XL (+420 ₽).
      packaging: { 15: 360, 19: 360, 25: 360, 29: 420, 33: 420, 51: 420 },
    },
    formCategory: "Букет-гигант",
    image: "/images/detail/roza-51-korobka.jpg",
  },
  {
    slug: "diantus-mix",
    name: "Диантус",
    description:
      "Кружевной моно из диантуса — нежный и очень стойкий, стоит в вазе дольше многих. Соберём в различных оттенках: от пудрового до насыщенного.",
    flowers: ["Диантус"],
    stems: { perStem: 128, options: [15, 25, 51, 101] },
    formCategory: "Монобукет",
    image: "/images/detail/diantus-mix.jpg",
  },
];

/**
 * Витринное округление: вверх до ближайшего ценника на «…90».
 * 564 → 590, 1 920 → 1 990, 6 500 → 6 590. Применяется к суммам
 * «количество × цена за штуку»; фикс-цены сборных не трогаем.
 */
export function prettyPrice(value: number): number {
  return Math.ceil((value + 10) / 100) * 100 - 10;
}

/** Итог поштучной позиции: цветы + доплата за упаковку, витринное округление. */
export function stemTotal(stems: StemPricing, qty: number): number {
  return prettyPrice(qty * stems.perStem + (stems.packaging?.[qty] ?? 0));
}

export const products: Product[] = raw.map((p) => ({
  ...p,
  price: p.stems ? stemTotal(p.stems, p.stems.options[0]) : (p.price ?? 0),
}));

/** «7 500 ₽» with a narrow no-break space as the thousands separator. */
export function formatPrice(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value) + " ₽";
}
