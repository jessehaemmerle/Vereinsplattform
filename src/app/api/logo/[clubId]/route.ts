import { db } from "@/lib/db";
import { readStoredFile } from "@/lib/storage";

export async function GET(_: Request, ctx: { params: Promise<{ clubId: string }> }) {
  const club = await db.club.findUnique({ where: { id: (await ctx.params).clubId }, select: { logoPath: true } });
  if (!club?.logoPath) return new Response(null, { status: 404 });
  const data = await readStoredFile(club.logoPath).catch(() => null);
  if (!data) return new Response(null, { status: 404 });
  const ext = club.logoPath.split(".").pop();
  const type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": type, "Cache-Control": "public, max-age=300", "Content-Security-Policy": "sandbox" },
  });
}
