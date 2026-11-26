import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { parseHost } from "@/lib/hosts";

/**
 * Caddy's on-demand TLS asks here before requesting a certificate for a host.
 * Only the root, admin and existing (or still-redirecting) club subdomains get one.
 */
export async function GET(req: NextRequest) {
  const host = parseHost(req.nextUrl.searchParams.get("domain"));
  if (host.kind === "root" || host.kind === "admin") return new Response("ok");
  if (host.kind === "club") {
    const graceStart = new Date(Date.now() - 90 * 86_400_000);
    const club = await db.club.findFirst({
      where: { OR: [{ slug: host.slug }, { previousSlug: host.slug, slugChangedAt: { gte: graceStart } }] },
      select: { id: true },
    });
    if (club) return new Response("ok");
  }
  return new Response("unknown", { status: 404 });
}
