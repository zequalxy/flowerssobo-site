import { getStorefrontCatalog, StorefrontError } from "@/lib/storefront-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(await getStorefrontCatalog(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof StorefrontError ? error.message : "Витрина временно недоступна. Попробуйте ещё раз." },
      { status: error instanceof StorefrontError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
