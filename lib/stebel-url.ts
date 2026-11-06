/** A bare app origin is accepted; custom API prefixes remain unchanged. */
export function stebelApiBase(url: URL): string {
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path || "/api"}`;
}
