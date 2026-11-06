"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CATALOG_REFRESH_MS, MAX_CART_LINES, MAX_ITEM_QUANTITY, UUID, catalogLifetime, checkoutLines, type CartLine, type CheckoutLine, type StorefrontCatalog, type StorefrontItem } from "@/lib/storefront";

const CART_KEY = "flowerssobo:cart:v1";
type StorefrontState = {
  catalog: StorefrontCatalog | null;
  state: "loading" | "ready" | "unavailable";
  error: string;
  cart: CartLine[];
  total: number;
  count: number;
  cartError: string;
  checkoutPending: boolean;
  setCheckoutPending: (pending: boolean) => void;
  refresh: () => Promise<void>;
  setQuantity: (id: string, quantity: number) => void;
  clear: () => void;
  checkout: () => CheckoutLine[];
};
const StorefrontContext = createContext<StorefrontState | null>(null);

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<StorefrontCatalog | null>(null);
  const [state, setState] = useState<StorefrontState["state"]>("loading");
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [restored, setRestored] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const request = useRef<AbortController | null>(null);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deadline = useRef(0);
  const mounted = useRef(false);
  const refreshAtExpiry = useRef<(() => Promise<void>) | null>(null);

  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const started = performance.now();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch("/api/storefront/catalog", { cache: "no-store", signal: controller.signal });
      const value = await response.json();
      if (!response.ok) throw new Error(typeof value.error === "string" ? value.error : "Наличие сейчас уточняется.");
      if (!mounted.current || request.current !== controller) return;
      const next = value as StorefrontCatalog;
      const lifetime = catalogLifetime(next) - (performance.now() - started);
      if (lifetime <= 0) throw new Error("Наличие обновляется. Повторите проверку.");
      deadline.current = performance.now() + lifetime;
      setCatalog(next);
      setState("ready");
      setError("");
      if (expiry.current) clearTimeout(expiry.current);
      expiry.current = setTimeout(() => {
        setState("unavailable");
        setError("Проверяем актуальное наличие…");
        void refreshAtExpiry.current?.();
      }, lifetime);
    } catch (failure) {
      if (!mounted.current || request.current !== controller) return;
      deadline.current = 0;
      setState("unavailable");
      setError(failure instanceof Error && failure.name !== "AbortError" ? failure.message : "Наличие сейчас уточняется. Попробуйте обновить витрину.");
    } finally { clearTimeout(timeout); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refreshAtExpiry.current = refresh;
    void refresh();
    // Refresh slightly before the 30s lifetime. No background demand in hidden tabs.
    const interval = setInterval(() => { if (!document.hidden) void refresh(); }, CATALOG_REFRESH_MS - 5000);
    const onFocus = () => { if (!document.hidden) void refresh(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      mounted.current = false;
      refreshAtExpiry.current = null;
      request.current?.abort();
      if (expiry.current) clearTimeout(expiry.current);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  useEffect(() => {
    // Restore after hydration so the server and first browser render agree.
    const frame = requestAnimationFrame(() => {
      try {
        const saved: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) ?? "[]");
        if (Array.isArray(saved) && saved.length <= MAX_CART_LINES) {
          const seen = new Set<string>();
          setCart(saved.filter((line): line is CartLine => {
            if (!line || typeof line !== "object" || typeof line.id !== "string" || !UUID.test(line.id) ||
                !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_ITEM_QUANTITY || seen.has(line.id)) return false;
            seen.add(line.id);
            return true;
          }).map(({ id, quantity }) => ({ id, quantity })));
        }
      } catch { /* Storage may be disabled; an in-memory cart remains usable. */ }
      setRestored(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { sessionStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch { /* Best effort. */ }
  }, [cart, restored]);

  const setQuantity = useCallback((id: string, quantity: number) => {
    if (checkoutPending) return;
    if (!Number.isSafeInteger(quantity)) return;
    setCart((previous) => {
      if (quantity <= 0) return previous.filter((line) => line.id !== id);
      const item = catalog?.items.find((candidate) => candidate.id === id);
      if (!item || state !== "ready" || performance.now() >= deadline.current || item.priceKopecks === null || item.priceKopecks < 1) return previous;
      const next = Math.min(quantity, item.available, MAX_ITEM_QUANTITY);
      if (next <= 0) return previous;
      if (previous.some((line) => line.id === id)) return previous.map((line) => line.id === id ? { id, quantity: next } : line);
      if (previous.length >= MAX_CART_LINES) return previous;
      return [...previous, { id, quantity: next }];
    });
  }, [catalog, state, checkoutPending]);

  const clear = useCallback(() => setCart([]), []);
  const checkout = useCallback(() => {
    if (!catalog || state !== "ready" || performance.now() >= deadline.current) throw new Error("Сначала обновите наличие в витрине.");
    return checkoutLines(cart, catalog);
  }, [cart, catalog, state]);

  const value = useMemo((): StorefrontState => {
    let cartError = "";
    if (cart.length) {
      if (state !== "ready" || !catalog) cartError = "Дождитесь проверки наличия перед отправкой заявки.";
      else { try { checkoutLines(cart, catalog); } catch (failure) { cartError = failure instanceof Error ? failure.message : "Проверьте выбранные позиции."; } }
    }
    return {
      catalog, state, error, cart,
      total: cart.reduce((sum, line) => sum + (catalog?.items.find((item) => item.id === line.id)?.priceKopecks ?? 0) * line.quantity, 0),
      count: cart.reduce((sum, line) => sum + line.quantity, 0),
      cartError, checkoutPending, setCheckoutPending, refresh, setQuantity, clear, checkout,
    };
  }, [catalog, state, error, cart, checkoutPending, refresh, setQuantity, clear, checkout]);
  return <StorefrontContext.Provider value={value}>{children}</StorefrontContext.Provider>;
}

export function useStorefront() {
  const value = useContext(StorefrontContext);
  if (!value) throw new Error("StorefrontProvider is required");
  return value;
}

export function selectable(item: StorefrontItem, ready: boolean) {
  return ready && item.available > 0 && item.priceKopecks !== null && item.priceKopecks >= 1;
}
