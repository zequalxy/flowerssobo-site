"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import {
  CaretDown,
  CircleNotch,
  CheckCircle,
  ArrowRight,
  Check,
} from "@phosphor-icons/react/dist/ssr";
import { toast } from "sonner";
import {
  orderSchema,
  contactMethods,
  type OrderInput,
} from "@/lib/schema";
import { categoryOptions } from "@/lib/catalog";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-xl border bg-bg-soft px-4 py-3 text-sm text-ink placeholder:text-faint outline-none transition-colors duration-200";

/** Lock the +7 prefix and format the rest as +7 (999) 123-45-67. */
function formatPhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  // The display always carries the country code — drop one leading 7/8.
  if (digits.startsWith("7") || digits.startsWith("8")) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  let res = "+7";
  if (digits.length > 0) res += " (" + digits.slice(0, 3);
  if (digits.length >= 4) res += ") " + digits.slice(3, 6);
  if (digits.length >= 7) res += "-" + digits.slice(6, 8);
  if (digits.length >= 9) res += "-" + digits.slice(8, 10);
  return res;
}

/**
 * Подпись + поле. Одиночное поле оборачивается в <label>; группа своих
 * <label> (чекбоксы способов связи) — в role="group": вложенные <label>
 * запрещены HTML, и скринридер путался, что к чему относится.
 */
function Field({
  label,
  required,
  error,
  children,
  className,
  group,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
  group?: boolean;
}) {
  const labelId = useId();
  const caption = (
    <span
      id={labelId}
      className="text-xs font-semibold uppercase tracking-[0.14em] text-muted"
    >
      {label}
      {required ? <span className="text-rose"> *</span> : null}
    </span>
  );
  const errorText = error ? (
    <span className="text-xs text-rose">{error}</span>
  ) : null;

  if (group) {
    return (
      <div
        role="group"
        aria-labelledby={labelId}
        className={cn("flex flex-col gap-2", className)}
      >
        {caption}
        {children}
        {errorText}
      </div>
    );
  }
  return (
    <label className={cn("flex flex-col gap-2", className)}>
      {caption}
      {children}
      {errorText}
    </label>
  );
}

/** Custom dropdown — fully themed, so options stay readable on every OS. */
function CustomSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Клавиатура: стрелки листают варианты (Enter/Escape уже работают — кнопка
  // закрывается по клику, документ слушает Escape). Фокус остаётся на кнопке.
  function onTriggerKey(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    if (!open) {
      setOpen(true);
      return;
    }
    const idx = options.indexOf(value);
    const next =
      e.key === "ArrowDown"
        ? Math.min(options.length - 1, idx + 1)
        : Math.max(0, idx - 1);
    onChange(options[next]);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKey}
        className={cn(
          inputClass,
          "flex items-center justify-between gap-2 text-left",
          open ? "border-rose" : "border-line",
        )}
      >
        <span className={value ? "text-ink" : "text-faint"}>
          {value || placeholder}
        </span>
        <CaretDown
          size={16}
          weight="bold"
          className={cn(
            "shrink-0 text-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformOrigin: "top" }}
            className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-auto rounded-xl border border-line bg-bg-elev p-1.5 shadow-[0_30px_60px_-25px_rgba(0,0,0,0.4)]"
          >
            {options.map((o) => {
              const active = value === o;
              return (
                <li key={o} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-150",
                      active
                        ? "bg-rose/15 text-rose"
                        : "text-ink/85 hover:bg-rose/10 hover:text-ink",
                    )}
                  >
                    {o}
                    {active ? <Check size={15} weight="bold" /> : null}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function OrderForm() {
  const [done, setDone] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      telegramNick: "",
      contactMethods: [],
      category: "",
      comment: "",
      consent: false,
      extraField: "",
    },
  });

  // Строка комментария, которую подставили мы сами. Нужна, чтобы снять её,
  // когда человек передумал и выбрал другое: свой текст при этом остаётся.
  const autoComment = useRef<string | null>(null);

  const applyPrefill = useCallback(
    (next: { category?: string; comment?: string }) => {
      if (next.category) setValue("category", next.category);

      const prev = autoComment.current;
      const current = getValues("comment") ?? "";
      const manual = (prev && current.includes(prev)
        ? current.replace(prev, "")
        : current
      )
        .replace(/\n{2,}/g, "\n")
        .trim();

      const added = next.comment ?? null;
      setValue(
        "comment",
        added ? (manual ? `${manual}\n${added}` : added) : manual,
        { shouldDirty: true },
      );
      autoComment.current = added;
    },
    [getValues, setValue],
  );

  // Pre-fill when a catalog card (string) or a bouquet card (object) is clicked.
  useEffect(() => {
    function onPrefill(e: Event) {
      const detail = (
        e as CustomEvent<string | { category?: string; comment?: string }>
      ).detail;
      if (!detail) return;
      applyPrefill(
        typeof detail === "string" ? { category: detail } : detail,
      );
    }
    window.addEventListener("flowerssobo:prefill", onPrefill);
    return () => window.removeEventListener("flowerssobo:prefill", onPrefill);
  }, [applyPrefill]);

  async function onSubmit(data: OrderInput) {
    let message =
      "Не удалось отправить. Позвоните нам или напишите в мессенджер.";
    try {
      const res = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        // Без таймаута зависшая сеть крутила бы «Отправляем…» бесконечно.
        signal: AbortSignal.timeout(15_000),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !json.ok) {
        // Сервер отвечает понятной фразой (лимит заявок, сбой доставки) —
        // её и показываем; сеть/таймаут/не-JSON остаются с общей фразой.
        if (json.error) message = json.error;
        throw new Error("order rejected");
      }

      toast.success("Заявка отправлена! Скоро свяжемся.");
      // Строку, подставленную из витрины, чистить не нужно: reset() обнулил
      // поле, и applyPrefill её уже не найдёт.
      reset();
      setDone(true);
    } catch {
      toast.error(message);
    }
  }

  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto grid max-w-[1400px] grid-cols-1 items-stretch gap-12 px-5 md:px-10 lg:grid-cols-12 lg:gap-14">
        {/* Bouquet beside the form — an exotic statement piece */}
        <div className="lg:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] border border-line-strong lg:h-full lg:aspect-auto">
            <Image
              src="/images/order-lily.jpg"
              alt="Авторский букет с лилиями, антуриумом и злаками — Flowerssobo"
              fill
              sizes="(max-width: 1024px) 90vw, 40vw"
              className="object-cover object-[center_38%]"
            />
            {/* Voice CTA — the phrase the owner loves, kept on a prime spot */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent p-6 pt-20 md:p-7 md:pt-24">
              <p className="text-sm text-white/80">Хотите голосом? Звоните:</p>
              <a
                href={site.phoneHref}
                className="mt-1 inline-block font-display text-2xl text-white transition-colors hover:text-rose md:text-3xl"
              >
                {site.phoneDisplay}
              </a>
            </div>
          </div>
        </div>

        {/* Form — сюда ведёт якорь #order, мимо фото слева/сверху */}
        <div id="order" className="scroll-mt-24 lg:col-span-7">
          <p className="eyebrow">Заявка</p>
          <h2 className="mt-4 text-balance text-4xl tracking-tight md:text-5xl">
            Персональный подбор цветов
          </h2>
          <p className="mt-6 max-w-xl text-pretty leading-relaxed text-muted">
            Расскажите о своих пожеланиях, и мы подберём букет или вазу из
            сезонных цветов, идеально подходящих для вас. Свяжитесь с менеджером —
            поможем с выбором.
          </p>

          <div className="mt-8 rounded-[1.75rem] border border-line bg-bg-elev/70 p-6 shadow-card md:p-9">
            {done ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-rose/15 text-rose">
                  <CheckCircle size={40} weight="light" />
                </span>
                <h3 className="mt-6 font-display text-3xl text-ink">
                  Спасибо! Заявка у нас
                </h3>
                <p className="mt-3 max-w-sm text-pretty text-muted">
                  Менеджер свяжется с вами в ближайшее время и поможет с выбором.
                </p>
                <button
                  type="button"
                  onClick={() => setDone(false)}
                  className="mt-8 rounded-full border border-line-strong px-6 py-3 text-sm font-semibold text-ink transition-colors hover:bg-bg-soft active:scale-[0.98]"
                >
                  Отправить ещё одну заявку
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2"
              >
                <Field
                  label="ФИО"
                  required
                  className="sm:col-span-2"
                  error={errors.fullName?.message}
                >
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Как к вам обращаться"
                    className={cn(
                      inputClass,
                      errors.fullName
                        ? "border-rose"
                        : "border-line focus:border-rose",
                    )}
                    {...register("fullName")}
                  />
                </Field>

                <Field label="Телефон" required error={errors.phone?.message}>
                  <Controller
                    control={control}
                    name="phone"
                    render={({ field }) => (
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+7 (___) ___-__-__"
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(formatPhone(e.target.value))
                        }
                        onFocus={(e) => {
                          const el = e.currentTarget;
                          // First click — reveal the locked +7 prefix.
                          if (!field.value) field.onChange("+7");
                          // Drop the caret after the +7 so users type the number.
                          requestAnimationFrame(() =>
                            el.setSelectionRange(
                              el.value.length,
                              el.value.length,
                            ),
                          );
                        }}
                        onBlur={() => {
                          // Nothing typed beyond +7 — clear so the mask returns.
                          if ((field.value ?? "").replace(/\D/g, "").length <= 1)
                            field.onChange("");
                          field.onBlur();
                        }}
                        className={cn(
                          inputClass,
                          errors.phone
                            ? "border-rose"
                            : "border-line focus:border-rose",
                        )}
                      />
                    )}
                  />
                </Field>

                <Field label="Ник в Telegram">
                  <input
                    type="text"
                    autoComplete="off"
                    placeholder="@ivan"
                    className={cn(inputClass, "border-line focus:border-rose")}
                    {...register("telegramNick")}
                  />
                </Field>

                <Field
                  label="Способ связи"
                  required
                  group
                  className="sm:col-span-2"
                  error={errors.contactMethods?.message}
                >
                  <div className="flex flex-wrap gap-2">
                    {contactMethods.map((m) => (
                      <label key={m.id} className="cursor-pointer">
                        <input
                          type="checkbox"
                          value={m.id}
                          className="peer sr-only"
                          {...register("contactMethods")}
                        />
                        <span className="flex items-center rounded-full border border-line bg-bg-soft px-4 py-2.5 text-sm text-muted transition-colors duration-200 hover:border-rose/40 peer-checked:border-rose peer-checked:bg-rose/15 peer-checked:text-rose peer-focus-visible:ring-2 peer-focus-visible:ring-rose/40">
                          {m.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label="Что нужно" className="sm:col-span-2">
                  <Controller
                    control={control}
                    name="category"
                    render={({ field }) => (
                      <CustomSelect
                        value={field.value ?? ""}
                        onChange={(v) => {
                          field.onChange(v);
                          applyPrefill({});
                        }}
                        options={categoryOptions}
                        placeholder="Необязательно — подскажем сами"
                      />
                    )}
                  />
                </Field>

                <Field
                  label="Комментарий"
                  className="sm:col-span-2"
                  error={errors.comment?.message}
                >
                  <textarea
                    rows={3}
                    placeholder="Пожелания: цвета, повод, дата и адрес доставки, текст открытки…"
                    className={cn(
                      inputClass,
                      "resize-none border-line focus:border-rose",
                    )}
                    {...register("comment")}
                  />
                </Field>

                {/* Honeypot — hidden from humans */}
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute left-[-9999px] h-0 w-0 opacity-0"
                  {...register("extraField")}
                />

                <div className="sm:col-span-2">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      {...register("consent")}
                    />
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border border-line-strong bg-bg-soft text-transparent transition-colors duration-200 peer-checked:border-rose peer-checked:bg-rose peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-rose/40">
                      <Check size={13} weight="bold" />
                    </span>
                    <span className="text-sm leading-snug text-muted">
                      Я даю{" "}
                      <a
                        href="/consent"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink underline underline-offset-2 transition-colors hover:text-rose"
                      >
                        согласие на обработку персональных данных
                      </a>{" "}
                      и подтверждаю ознакомление с{" "}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-ink underline underline-offset-2 transition-colors hover:text-rose"
                      >
                        Положением о конфиденциальности
                      </a>
                    </span>
                  </label>
                  {errors.consent ? (
                    <p className="mt-2 text-xs text-rose">
                      {errors.consent.message}
                    </p>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-rose px-6 py-4 text-sm font-semibold text-white transition-colors duration-200 hover:bg-rose-deep active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isSubmitting ? (
                      <>
                        <CircleNotch size={18} weight="bold" className="animate-spin" />
                        Отправляем…
                      </>
                    ) : (
                      <>
                        Оставить заявку
                        <ArrowRight size={18} weight="bold" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
