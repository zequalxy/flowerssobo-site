import type { NextConfig } from "next";

/**
 * CSP: 'unsafe-inline' для script/style — вынужденный компромисс из-за
 * инлайн-скриптов Next и инлайн-стилей framer-motion; сторонних скриптов на
 * сайте нет вовсе, поэтому даже такой CSP отсекает основные векторы.
 */
const securityHeaders = [
  // HSTS: браузер сам уводит на https и не даёт перехватить первый заход по
  // голому http. Учитывается только по HTTPS, поэтому локально безвреден;
  // в dev не шлём, чтобы не «прилипал» к localhost за прокси.
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
    : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    // 'unsafe-eval' нужен только React-у в dev-режиме; в проде его нет.
    value: `default-src 'self'; script-src 'self' 'unsafe-inline'${
      process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""
    }; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  },
];

const nextConfig: NextConfig = {
  // Самодостаточный server.js в .next/standalone — его запускает Dockerfile.
  // Vercel этот режим просто игнорирует, деплою не мешает.
  output: "standalone",
  // Явный корень: иначе Turbopack берёт C:\Users\<user> (лишний lockfile),
  // кириллица из «Рабочий стол» попадает в имена чанков и роняет dev/build
  // паникой «byte index is not a char boundary» на Windows.
  turbopack: { root: __dirname },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
