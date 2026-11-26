import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { getTenant } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";
import { clubUrl } from "@/lib/hosts";

const HOURS = 1;

/** Redeems a one-time ticket from the admin host and opens a one-hour session inside the club. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const tenant = await getTenant();
  const ticket = token ? await db.impersonationTicket.findUnique({ where: { tokenHash: sha256(token) } }) : null;
  const valid = ticket && !ticket.usedAt && ticket.expiresAt > new Date() && tenant.kind === "club" && tenant.club?.id === ticket.clubId;
  if (!valid) return new Response("Dieser Link ist ungültig oder abgelaufen.", { status: 403 });
  // single use, guarded against a concurrent second redemption
  const { count } = await db.impersonationTicket.updateMany({ where: { id: ticket.id, usedAt: null }, data: { usedAt: new Date() } });
  const admin = await db.user.findUnique({ where: { id: ticket.adminId } });
  if (!count || !admin?.isPlatformAdmin) return new Response("Dieser Link ist ungültig oder abgelaufen.", { status: 403 });

  await createSession(admin.id, { impersonatedClubId: ticket.clubId, hours: HOURS });
  await logActivity({ clubId: ticket.clubId, userId: admin.id, action: "impersonation_started", detail: `Plattform-Admin ${admin.name}, ${HOURS} h` });
  const res = NextResponse.redirect(clubUrl(tenant.club!.slug, "/dashboard"));
  res.headers.set("Referrer-Policy", "no-referrer"); // the one-time token is in this URL
  return res;
}
