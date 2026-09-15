import { z } from "zod";

/** Preferred contact channels — id is stored, label is shown in the form. */
export const contactMethods = [
  { id: "telegram", label: "Телеграм" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "phone", label: "Телефон" },
] as const;

/**
 * Order/request schema — validated on the client (react-hook-form) and again
 * on the server (API route) before sending to Telegram. Required: ФИО, phone,
 * at least one contact method, and consent. Everything else is optional.
 */
export const orderSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Укажите ФИО")
    .max(80, "Слишком длинное значение"),
  phone: z
    .string()
    .trim()
    .min(6, "Укажите телефон")
    .max(30, "Проверьте номер")
    .regex(/^[\d\s()+\-]+$/, "Только цифры и + ( ) -")
    .refine((v) => v.replace(/\D/g, "").length >= 11, "Введите номер полностью"),
  telegramNick: z.string().trim().max(64).optional().or(z.literal("")),
  contactMethods: z
    .array(z.enum(["telegram", "whatsapp", "phone"]))
    .min(1, "Выберите хотя бы один способ связи"),
  category: z.string().trim().max(60).optional().or(z.literal("")),
  comment: z.string().trim().max(1000).optional().or(z.literal("")),
  consent: z
    .boolean()
    .refine((v) => v === true, "Подтвердите согласие, чтобы отправить заявку"),
  // Honeypot — humans never see it. Filled = bot; dropped silently in the route.
  // Бессмысленное имя, чтобы автозаполнение браузера не совало сюда «организацию»,
  // и без max() — длинная строка бота не должна выдавать валидацию ошибкой 422.
  extraField: z.string().optional(),
});

const METHOD_LABELS: Record<string, string> = Object.fromEntries(
  contactMethods.map((m) => [m.id, m.label]),
);

/** Человекочитаемый список способов связи — и для Telegram, и для Posiflora. */
export function contactMethodLabels(ids: readonly string[] = []): string {
  return ids.map((id) => METHOD_LABELS[id] ?? id).join(", ");
}

export type OrderInput = z.infer<typeof orderSchema>;
