import { getTenant } from "@/lib/tenant";
import { readStoredFile } from "@/lib/storage";
import { BRAND_ASSETS, type BrandAsset } from "@/lib/branding";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", ico: "image/x-icon" };

/** Public brand assets of the club addressed by the host (needed on the login page and in e-mails). */
export async function GET(_: Request, ctx: { params: Promise<{ asset: string }> }) {
  const { asset } = await ctx.params;
  const tenant = await getTenant();
  if (tenant.kind !== "club" || !tenant.club || !(asset in BRAND_ASSETS)) return new Response(null, { status: 404 });
  const path = tenant.club[BRAND_ASSETS[asset as BrandAsset]];
  if (!path) return new Response(null, { status: 404 });
  const data = await readStoredFile(path).catch(() => null);
  if (!data) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": TYPES[path.split(".").pop() ?? ""] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
