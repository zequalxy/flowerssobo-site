import { readCapped, storefrontConfig } from "@/lib/storefront-server";
import { UUID } from "@/lib/storefront";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });
  try {
    const cfg = storefrontConfig();
    const response = await fetch(`${cfg.baseUrl}/site/storefront/images/${id}`, {
      headers: { "X-Stebel-Key": cfg.key }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(7000),
    });
    const type = response.headers.get("content-type")?.split(";")[0];
    if (!response.ok || !type || !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(type)) {
      return new Response(null, { status: response.status === 404 ? 404 : 502 });
    }
    const bytes = await readCapped(response, 8 * 1024 * 1024);
    return new Response(bytes.buffer as ArrayBuffer, { headers: {
      "Content-Type": type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch { return new Response(null, { status: 502 }); }
}
