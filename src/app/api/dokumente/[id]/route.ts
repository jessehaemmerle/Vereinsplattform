import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { readStoredFile } from "@/lib/storage";

const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"]);

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user?.clubId) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await ctx.params;
  const doc = await db.document.findFirst({ where: { id, clubId: user.clubId } });
  const allowed = doc && (can(user.role, "docs:read") || (doc.visibleToMembers && !!user.member));
  if (!doc || !allowed) return new Response("Nicht gefunden", { status: 404 });
  const data = await readStoredFile(doc.storageName).catch(() => null);
  if (!data) return new Response("Datei fehlt im Speicher", { status: 410 });
  const disposition = INLINE.has(doc.mimeType) ? "inline" : "attachment";
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": INLINE.has(doc.mimeType) ? doc.mimeType : "application/octet-stream",
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
      "Content-Security-Policy": "sandbox",
      "Cache-Control": "private, no-store",
    },
  });
}
