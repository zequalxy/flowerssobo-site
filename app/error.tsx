"use client";

import { useEffect } from "react";

/** Фолбэк рантайм-ошибок страницы — фирменный тон и кнопка «попробовать ещё». */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // В браузерную консоль — чтобы по digest сопоставить с логом сервера.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <p className="eyebrow">Ошибка</p>
      <h1 className="mt-4 font-display text-3xl tracking-tight text-ink md:text-4xl">
        Что-то пошло не так
      </h1>
      <p className="mt-4 max-w-md text-pretty leading-relaxed text-muted">
        Попробуйте обновить страницу. Если не помогло — позвоните нам, мы на
        связи.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-8 rounded-full bg-rose px-7 py-3.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-rose-deep active:scale-[0.98]"
      >
        Попробовать ещё раз
      </button>
    </div>
  );
}
