import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { parseHost, requestHost } from "@/lib/hosts";

/** The tenant addressed by the current request's host. Always derived server-side, never from client headers. */
export const getTenant = cache(async () => {
  const h = await headers();
  const host = parseHost(requestHost(h));
  if (host.kind !== "club") return { ...host, club: null } as const;
  const club = await db.club.findUnique({ where: { slug: host.slug } });
  return { kind: "club" as const, slug: host.slug, club };
});

export async function requireTenantClub() {
  const tenant = await getTenant();
  return tenant.kind === "club" ? tenant.club : null;
}
