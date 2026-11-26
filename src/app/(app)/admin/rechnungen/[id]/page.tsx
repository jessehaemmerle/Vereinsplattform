import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { issuerSettings, missingIssuerData, platformIssuer, snapshotOf } from "@/lib/invoices";
import { PageHeader } from "@/components/ui/misc";
import { InvoiceEditor, type RecipientOption } from "@/components/invoices/invoice-editor";
import { DraftActions, InvoiceSummary, toDraft } from "@/components/invoices/invoice-views";
import { platformInvoiceAction, savePlatformInvoice } from "../actions";

export const metadata = { title: "Rechnung" };

export default async function PlatformInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const issuer = await platformIssuer();
  const { taxMode } = issuerSettings(issuer);
  const clubs = await db.club.findMany({ orderBy: { name: "asc" }, include: { users: { where: { role: "ADMIN" }, take: 1 } } });
  const recipients: RecipientOption[] = clubs.map((c) => ({
    key: `club:${c.id}`,
    label: c.name,
    name: c.name,
    address: c.address,
    email: c.email ?? c.users[0]?.email ?? null,
    vatId: c.vatId,
    ref: { field: "recipientClubId", id: c.id },
  }));

  if (id === "neu") {
    return (
      <>
        <PageHeader title="Rechnung erstellen" />
        <InvoiceEditor action={savePlatformInvoice.bind(null, null)} taxMode={taxMode} recipients={recipients} cancelHref="/admin/rechnungen" />
      </>
    );
  }
  const invoice = await db.invoice.findFirst({ where: { id, issuerClubId: null }, include: { items: true, license: true, cancels: true, cancelledBy: true } });
  if (!invoice) notFound();

  if (invoice.status === "DRAFT") {
    return (
      <>
        <PageHeader title="Rechnungsentwurf" description={invoice.license ? `Automatisch erstellt für die Lizenz „${invoice.license.name}“` : undefined} />
        <DraftActions
          invoice={invoice}
          action={platformInvoiceAction}
          missing={missingIssuerData(snapshotOf(issuer), taxMode)}
          hasEmail={!!invoice.recipientEmail}
        />
        <InvoiceEditor
          action={savePlatformInvoice.bind(null, invoice.id)}
          taxMode={taxMode}
          recipients={recipients}
          initial={toDraft(invoice, invoice.recipientClubId ? `club:${invoice.recipientClubId}` : undefined)}
          cancelHref="/admin/rechnungen"
        />
      </>
    );
  }
  const related = invoice.cancels
    ? { href: `/admin/rechnungen/${invoice.cancels.id}`, label: `storniert Rechnung ${invoice.cancels.number}` }
    : invoice.cancelledBy
      ? { href: `/admin/rechnungen/${invoice.cancelledBy.id}`, label: `storniert durch ${invoice.cancelledBy.number}` }
      : invoice.license
        ? { href: `/admin/lizenzen/${invoice.license.id}`, label: `Lizenz „${invoice.license.name}“` }
        : null;
  return (
    <>
      <PageHeader title={`${invoice.kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung"} ${invoice.number}`} description={invoice.recipientName} />
      <InvoiceSummary invoice={invoice} action={platformInvoiceAction} canWrite related={related} />
    </>
  );
}
