import "server-only";
import { headers } from "next/headers";
import { protocol, requestHost } from "@/lib/hosts";
import { getTenant } from "@/lib/tenant";

/**
 * Relying party for passkeys = the host the user is on. A passkey created on a club's subdomain only works there,
 * which matches the host-bound logins.
 */
export async function relyingParty() {
  const tenant = await getTenant();
  if (tenant.kind !== "club" && tenant.kind !== "admin") throw new Error("Passkeys sind nur auf Vereins- und Admin-Adressen möglich.");
  const host = requestHost(await headers())!;
  return {
    rpID: host.replace(/:\d+$/, ""),
    origin: `${protocol()}://${host}`,
    rpName: tenant.kind === "club" && tenant.club ? tenant.club.name : "Vereinsplattform",
  };
}
