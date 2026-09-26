"use client";

import { useEffect } from "react";
import { site } from "@/lib/site";

/**
 * Последний рубеж: ошибка в корневом layout. Next рендерит этот файл вместо
 * всего документа — без globals.css и шрифтов, поэтому стили инлайном.
 * Главное здесь — телефон: даже с упавшим сайтом клиент может заказать.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          color: "#4e5142",
          background: "#ffffff",
        }}
      >
        <title>Flowerssobo — что-то пошло не так</title>
        <h1 style={{ margin: 0, fontSize: "28px", lineHeight: 1.2 }}>
          Что-то пошло не так
        </h1>
        <p style={{ maxWidth: "420px", marginTop: "16px", lineHeight: 1.6 }}>
          Попробуйте обновить страницу. Если не помогло — позвоните нам, примем
          заказ по телефону:
        </p>
        <a
          href={site.phoneHref}
          style={{
            marginTop: "8px",
            fontSize: "24px",
            color: "#677535",
            textDecoration: "none",
            fontWeight: 600,
          }}
        >
          {site.phoneDisplay}
        </a>
        <button
          type="button"
          onClick={() => retry()}
          style={{
            marginTop: "28px",
            padding: "14px 28px",
            border: 0,
            borderRadius: "999px",
            background: "#677535",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Попробовать ещё раз
        </button>
      </body>
    </html>
  );
}
