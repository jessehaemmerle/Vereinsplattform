import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { issuerSettings, missingIssuerData, snapshotOf } from "@/lib/invoices";
import { PageHeader } from "@/components/ui/misc";
import { InvoiceEditor, type RecipientOption } from "@/components/invoices/invoice-editor";
import { DraftActions, InvoiceSummary, toDraft } from "@/components/invoices/invoice-views";
import { clubInvoiceAction, saveClubInvoice } from "../actions";

export const metadata = { title: "Rechnung" };

export default async function ClubInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("finance:read", "FINANZEN");
  const { id } = await params;
  const canWrite = can(user.role, "invoices:write");
  const issuer = { kind: "club" as const, club: user.club };
  const { taxMode } = issuerSettings(issuer);

  const recipientOptions = async (): Promise<RecipientOption[]> => {
    const [contacts, members] = await Promise.all([
      db.contact.findMany({ where: { clubId: user.clubId }, orderBy: { name: "asc" } }),
      db.member.findMany({ where: { clubId: user.clubId, status: { not: "AUSGETRETEN" } }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] }),
    ]);
    return [
      ...contacts.map((c) => ({
        key: `contact:${c.id}`,
        label: `${c.name} (Adressbuch)`,
        name: c.name,
        address: c.address,
        email: c.email,
        vatId: c.vatId,
        ref: { field: "recipientContactId" as const, id: c.id },
      })),
      ...members.map((m) => ({
        key: `member:${m.id}`,
        label: `${m.lastName} ${m.firstName} (Mitglied)`,
        name: `${m.firstName} ${m.lastName}`,
        address: [m.street, [m.zip, m.city].filter(Boolean).join(" ")].filter(Boolean).join("\n") || null,
        email: m.email,
        vatId: null,
        ref: { field: "recipientMemberId" as const, id: m.id },
      })),
    ];
  };

  if (id === "neu") {
    if (!canWrite) notFound();
    return (
      <>
        <PageHeader title="Rechnung schreiben" />
        <InvoiceEditor
          action={saveClubInvoice.bind(null, null)}
          taxMode={taxMode}
          recipients={await recipientOptions()}
          cancelHref="/rechnungen"
          allowSaveContact
        />
      </>
    );
  }
  const invoice = await db.invoice.findFirst({
    where: { id, issuerClubId: user.clubId },
    include: { items: true, cancels: true, cancelledBy: true, booking: true },
  });
  if (!invoice) notFound();

  if (invoice.status === "DRAFT") {
    if (!canWrite) notFound();
    const key = invoice.recipientContactId
      ? `contact:${invoice.recipientContactId}`
      : invoice.recipientMemberId
        ? `member:${invoice.recipientMemberId}`
        : undefined;
    return (
      <>
        <PageHeader title="Rechnungsentwurf" />
        <DraftActions
          invoice={invoice}
          action={clubInvoiceAction}
          missing={missingIssuerData(snapshotOf(issuer), taxMode)}
          hasEmail={!!invoice.recipientEmail}
        />
        <InvoiceEditor
          action={saveClubInvoice.bind(null, invoice.id)}
          taxMode={taxMode}
          recipients={await recipientOptions()}
          initial={toDraft(invoice, key)}
          cancelHref="/rechnungen"
          allowSaveContact
        />
      </>
    );
  }
  const related = invoice.cancels
    ? { href: `/rechnungen/${invoice.cancels.id}`, label: `storniert Rechnung ${invoice.cancels.number}` }
    : invoice.cancelledBy
      ? { href: `/rechnungen/${invoice.cancelledBy.id}`, label: `storniert durch ${invoice.cancelledBy.number}` }
      : null;
  return (
    <>
      <PageHeader title={`${invoice.kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung"} ${invoice.number}`} description={invoice.recipientName} />
      <InvoiceSummary
        invoice={invoice}
        action={clubInvoiceAction}
        canWrite={canWrite}
        related={related}
        bookingNote={
          invoice.booking
            ? `Im Kassabuch gebucht am ${invoice.booking.date.toLocaleDateString("de-AT", { timeZone: "UTC" })} (Kategorie „${invoice.booking.category}“).`
            : undefined
        }
      />
    </>
  );
}
