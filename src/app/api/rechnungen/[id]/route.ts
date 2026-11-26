import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { apiUser } from "@/lib/api-auth";
import { getTenant } from "@/lib/tenant";
import { platformIssuer, snapshotOf } from "@/lib/invoices";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

/**
 * Invoice PDF. Platform admin (admin host): every platform invoice. Club (own host, finance:read):
 * invoices it issued and the platform's issued invoices addressed to it – never drafts of others.
 */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const tenant = await getTenant();
  let invoice;
  let snapshot;

  if (tenant.kind === "admin") {
    const user = await getCurrentUser();
    if (!user?.isPlatformAdmin || user.mfaSetupRequired) return new Response("Kein Zugriff", { status: 403 });
    invoice = await db.invoice.findFirst({ where: { id, issuerClubId: null }, include: { items: true } });
    snapshot = snapshotOf(await platformIssuer());
  } else {
    const user = await apiUser("finance:read");
    if (!user) return new Response("Kein Zugriff", { status: 403 });
    invoice = await db.invoice.findFirst({
      where: {
        id,
        OR: [{ issuerClubId: user.clubId }, { issuerClubId: null, recipientClubId: user.clubId, status: { not: "DRAFT" } }],
      },
      include: { items: true },
    });
    if (invoice?.issuerClubId) snapshot = snapshotOf({ kind: "club", club: user.club });
    else snapshot = snapshotOf(await platformIssuer());
  }
  if (!invoice) return new Response("Nicht gefunden", { status: 404 });

  const pdf = await renderInvoicePdf(invoice, snapshot);
  const name = invoice.number ?? `Entwurf-${invoice.id.slice(-6)}`;
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${name}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
