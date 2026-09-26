export type Category = {
  slug: string;
  title: string;
  blurb: string;
  image: string;
  /** Pre-fills the order form when a card is clicked. */
  formValue: string;
  /** CSS object-position for the tile crop, when center isn't ideal. */
  objectPosition?: string;
  /**
   * Кадр 4:5 для раскрытой карточки (public/images/detail/cat-<slug>.jpg),
   * скадрированный по композиции. Плитка берёт `image` — у неё своя форма в бенто.
   */
  detailImage: string;
  /** Full-width banner (spans all columns) — drives a wider `next/image` sizes. */
  wide?: boolean;
  /** Full-width только на мобильном — иначе next/image просит картинку под 50vw и мылит её. */
  wideOnMobile?: boolean;
};

/**
 * Каталог-коллаж: фото — реальные работы из `public/images/catalog`, подпись
 * лежит поверх снимка. Раскладка плиток задаётся в `Categories.tsx` (бенто).
 * Клик по плитке префилит форму заявки.
 */
export const categories: Category[] = [
  {
    slug: "mono",
    title: "Моно",
    blurb: "Один сорт, чистая форма и акцент на сам цветок.",
    image: "/images/catalog/mono.jpg",
    detailImage: "/images/detail/cat-mono.jpg",
    formValue: "Монобукет",
    objectPosition: "50% 38%",
  },
  {
    slug: "giant",
    title: "Букет-гигант",
    blurb: "Максимальный объём для тех случаев, когда хочется впечатлить.",
    image: "/images/catalog/giant.jpg",
    detailImage: "/images/detail/cat-giant.jpg",
    formValue: "Букет-гигант",
    objectPosition: "50% 38%",
  },
  {
    slug: "trend",
    title: "Трендовый",
    blurb: "Собран в актуальной эстетике: модные цветы, оттенки и сочетания.",
    image: "/images/catalog/trend.jpg",
    detailImage: "/images/detail/cat-trend.jpg",
    formValue: "Трендовый букет",
    objectPosition: "50% 42%",
  },
  {
    slug: "custom",
    title: "Кастомный",
    blurb: "Соберём под вас: по оттенкам, настроению, формату и бюджету.",
    image: "/images/catalog/custom.jpg",
    detailImage: "/images/detail/cat-custom.jpg",
    formValue: "Кастомный букет",
    objectPosition: "50% 55%",
  },
  {
    slug: "wedding",
    title: "Свадебный",
    blurb: "Букет невесты и оформление — от каллы до выездной церемонии.",
    image: "/images/catalog/wedding.jpg",
    detailImage: "/images/detail/cat-wedding.jpg",
    formValue: "Свадебная флористика",
    // Каскадный букет занимает нижние две трети кадра — смещаем окно вниз,
    // иначе в плитку попадает пустая стена, а не цветы.
    objectPosition: "50% 70%",
  },
  {
    slug: "interior",
    title: "Интерьерный",
    blurb: "Композиции для дома, ресторана, лобби отеля или офиса, собранные под стилистику пространства.",
    image: "/images/catalog/interior.jpg",
    detailImage: "/images/detail/cat-interior.jpg",
    formValue: "Интерьерная композиция",
    objectPosition: "50% 58%",
  },
  {
    slug: "jute",
    title: "Джутовые котомки",
    blurb: "Цветы в плетёном джутовом кашпо — готовый подарок, ваза не нужна.",
    image: "/images/catalog/jute.jpg",
    detailImage: "/images/detail/cat-jute.jpg",
    formValue: "Цветы в джутовой котомке",
    wideOnMobile: true,
    // Файл уже обрезан по композиции (снята пустая стена сверху), так что
    // букет с котомкой сидит по центру кадра — смещать окно не нужно.
    objectPosition: "50% 50%",
  },
  {
    slug: "business",
    title: "Цветы для бизнеса",
    blurb: "Поставки свежих цветов для компаний, мероприятий и оформления на специальных условиях.",
    image: "/images/catalog/business.jpg",
    detailImage: "/images/detail/cat-business.jpg",
    formValue: "Цветы для бизнеса",
    objectPosition: "50% 50%",
    wide: true,
  },
];

/** Options for the order form's «что нужно» select. */
export const categoryOptions: string[] = [
  ...categories.map((c) => c.formValue),
  "Не определился — нужен совет флориста",
];

