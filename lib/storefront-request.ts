/** One idempotency key per exact submitted intent; no contact details go into storage. */
const KEY = "flowerssobo:storefront-request:v1";
let memory: { fingerprint: string; id: string } | null = null;

export type StorefrontSubmission<T> = { requestId: string; payload: T };

/** An uncertain attempt must be replayed verbatim, even if the current cart/price changed. */
export async function prepareStorefrontSubmission<T>(payload: T, pending: StorefrontSubmission<T> | null): Promise<StorefrontSubmission<T>> {
  if (pending) return pending;
  const snapshot = structuredClone(payload);
  return { requestId: await storefrontRequestId(snapshot), payload: snapshot };
}

export function definitiveStorefrontFailure(status: number): boolean {
  return [400, 403, 409, 415, 422, 429].includes(status);
}

export async function storefrontRequestId(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  let saved = memory;
  try { saved = JSON.parse(sessionStorage.getItem(KEY) ?? "null") ?? saved; } catch { /* In-memory retry still works. */ }
  if (saved?.fingerprint === fingerprint && typeof saved.id === "string") return saved.id;
  memory = { fingerprint, id: crypto.randomUUID() };
  try { sessionStorage.setItem(KEY, JSON.stringify(memory)); } catch { /* Storage is optional. */ }
  return memory.id;
}

export function clearStorefrontRequest() {
  memory = null;
  try { sessionStorage.removeItem(KEY); } catch { /* Storage is optional. */ }
}
