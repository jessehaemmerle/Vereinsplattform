import "server-only";
import type { Club, Invoice, InvoiceItem, PlatformSettings, Prisma, TaxMode } from "@prisma/client";
import { db } from "@/lib/db";
import { getPlatformSettings } from "@/lib/legal";
import { platformName } from "@/lib/platform";
import { computeTotals, formatInvoiceNumber, licensePeriod, netFromGross } from "@/lib/invoice-calc";
import { formatDate, viennaDay, viennaYear } from "@/lib/format";

/** Issuer data as printed on the invoice; frozen into the invoice when it is issued. */
export type IssuerSnapshot = {
  name: string;
  addressLines: string[];
  email: string | null;
  phone: string | null;
  vatId: string | null;
  register: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  footer: string | null;
  logoPath: string | null;
  color: string | null;
  /** street plus postal code and city present */
  addressComplete: boolean;
};

export type InvoiceWithItems = Invoice & { items: InvoiceItem[] };

export type Issuer = { kind: "platform"; settings: PlatformSettings } | { kind: "club"; club: Club };

export async function platformIssuer(): Promise<Issuer> {
  return { kind: "platform", settings: await getPlatformSettings() };
}

export function issuerKey(issuer: Issuer) {
  return issuer.kind === "platform" ? "platform" : issuer.club.id;
}

export function issuerSettings(issuer: Issuer) {
  const s = issuer.kind === "platform" ? issuer.settings : issuer.club;
  return { taxMode: s.taxMode, prefix: s.invoicePrefix || "RE", paymentTermsDays: s.paymentTermsDays };
}

export function snapshotOf(issuer: Issuer): IssuerSnapshot {
  if (issuer.kind === "platform") {
    const s = issuer.settings;
    return {
      name: [s.operatorName || platformName(), s.legalForm].filter(Boolean).join(", "),
      addressLines: [s.street, s.zipCity, s.country].filter(Boolean) as string[],
      email: s.email,
      phone: s.phone,
      vatId: s.vatId,
      register: s.companyRegister,
      iban: s.iban,
      bic: s.bic,
      bankName: s.bankName,
      footer: s.invoiceFooter,
      logoPath: null,
      color: null,
      addressComplete: !!s.street?.trim() && !!s.zipCity?.trim(),
    };
  }
  const c = issuer.club;
  const addressLines = (c.address ?? "")
    .split(/\r?\n|,\s*/)
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    name: c.name,
    addressLines,
    email: c.email,
    phone: null,
    vatId: c.vatId,
    register: null,
    iban: c.iban,
    bic: c.bic,
    bankName: c.bankName,
    footer: c.invoiceFooter,
    logoPath: c.logoPath,
    color: c.primaryColor,
    // free-text address of the club: at least "street" and "postal code city"
    addressComplete: addressLines.length >= 2 && addressLines.some((l) => /\d{4,5}\s+\S/.test(l)),
  };
}

/** What an issuer must have before it may issue an invoice (§ 11 UStG). */
export function missingIssuerData(snapshot: IssuerSnapshot, taxMode: TaxMode) {
  const missing: string[] = [];
  if (!snapshot.name.trim()) missing.push("Name");
  if (!snapshot.addressComplete) missing.push("Anschrift (Straße, PLZ und Ort)");
  if (taxMode === "STEUERPFLICHTIG" && !snapshot.vatId) missing.push("UID-Nummer");
  return missing;
}

export type DraftInput = {
  recipientName: string;
  recipientAddress: string | null;
  recipientEmail: string | null;
  recipientVatId: string | null;
  recipientClubId?: string | null;
  recipientContactId?: string | null;
  recipientMemberId?: string | null;
  servicePeriod: string | null;
  intro: string | null;
  notes: string | null;
  items: { description: string; quantity: number; unit: string | null; unitCents: number; taxRate: number }[];
};

/** Creates or replaces a draft (only drafts can change). */
type DraftLinks = { licenseId?: string; licensePeriodEnd?: Date; feeYear?: number };

export async function saveDraft(issuer: Issuer, input: DraftInput, id?: string, extra: DraftLinks = {}) {
  const { taxMode } = issuerSettings(issuer);
  const totals = computeTotals(input.items, taxMode);
  const issuerClubId = issuer.kind === "club" ? issuer.club.id : null;
  const { items, ...fields } = input;
  const data = { ...fields, taxMode, netCents: totals.netCents, taxCents: totals.taxCents, grossCents: totals.grossCents };
  const itemRows = items.map((i, position) => ({ ...i, position }));
  if (id) {
    const existing = await db.invoice.findFirst({ where: { id, issuerClubId, status: "DRAFT" } });
    if (!existing) throw new InvoiceError("Nur Entwürfe können bearbeitet werden.");
    return db.invoice.update({ where: { id }, data: { ...data, items: { deleteMany: {}, create: itemRows } } });
  }
  return db.invoice.create({ data: { ...data, issuerClubId, ...extra, items: { create: itemRows } } });
}

export class InvoiceError extends Error {
  name = "InvoiceError";
}

/** Next number of the issuer's sequence for the year – atomic, so parallel requests never get the same one. */
async function nextNumber(tx: Prisma.TransactionClient, key: string, year: number) {
  const rows = await tx.$queryRaw<{ last: number }[]>`
    INSERT INTO "InvoiceCounter" ("issuerKey", "year", "last") VALUES (${key}, ${year}, 1)
    ON CONFLICT ("issuerKey", "year") DO UPDATE SET "last" = "InvoiceCounter"."last" + 1
    RETURNING "last"`;
  return rows[0].last;
}

/** Turns a draft into an issued invoice: number, date, due date and frozen issuer data. */
export async function issueInvoice(issuer: Issuer, id: string) {
  const issuerClubId = issuer.kind === "club" ? issuer.club.id : null;
  const snapshot = snapshotOf(issuer);
  const { taxMode, prefix, paymentTermsDays } = issuerSettings(issuer);
  const missing = missingIssuerData(snapshot, taxMode);
  if (missing.length) throw new InvoiceError(`Für Rechnungen fehlen noch Angaben des Ausstellers: ${missing.join(", ")}.`);

  return db.$transaction(async (tx) => {
    const draft = await tx.invoice.findFirst({ where: { id, issuerClubId, status: "DRAFT" }, include: { items: true } });
    if (!draft) throw new InvoiceError("Diese Rechnung ist kein Entwurf mehr.");
    if (!draft.items.length) throw new InvoiceError("Die Rechnung hat keine Positionen.");
    const today = viennaDay();
    const year = viennaYear();
    const n = await nextNumber(tx, issuerKey(issuer), year);
    // the tax mode valid on the issue date applies
    const totals = computeTotals(
      draft.items.map((i) => ({ quantity: Number(i.quantity), unitCents: i.unitCents, taxRate: i.taxRate })),
      taxMode,
    );
    return tx.invoice.update({
      where: { id },
      data: {
        status: "ISSUED",
        number: formatInvoiceNumber(prefix, year, n),
        issueDate: today,
        dueDate: draft.dueDate ?? new Date(today.getTime() + paymentTermsDays * 86_400_000),
        taxMode,
        issuerSnapshot: snapshot,
        netCents: totals.netCents,
        taxCents: totals.taxCents,
        grossCents: totals.grossCents,
      },
      include: { items: true },
    });
  });
}

/** Stornorechnung: a new issued invoice with negated amounts; the original becomes CANCELLED. */
export async function cancelInvoice(issuer: Issuer, id: string) {
  const issuerClubId = issuer.kind === "club" ? issuer.club.id : null;
  const original = await db.invoice.findFirst({ where: { id, issuerClubId, kind: "INVOICE", status: { in: ["ISSUED", "PAID"] } }, include: { items: true } });
  if (!original) throw new InvoiceError("Nur ausgestellte Rechnungen können storniert werden.");
  const draft = await db.invoice.create({
    data: {
      issuerClubId,
      kind: "CANCELLATION",
      cancelsId: original.id,
      taxMode: original.taxMode,
      recipientClubId: original.recipientClubId,
      recipientContactId: original.recipientContactId,
      recipientMemberId: original.recipientMemberId,
      recipientName: original.recipientName,
      recipientAddress: original.recipientAddress,
      recipientEmail: original.recipientEmail,
      recipientVatId: original.recipientVatId,
      servicePeriod: original.servicePeriod,
      intro: `Wir stornieren hiermit die Rechnung ${original.number} vom ${formatDate(original.issueDate)}.`,
      // a cancellation is settled with the original: nothing new to pay
      dueDate: viennaDay(),
      items: {
        create: original.items.map((i) => ({
          position: i.position,
          description: i.description,
          quantity: i.quantity,
          unit: i.unit,
          unitCents: -i.unitCents,
          taxRate: i.taxRate,
        })),
      },
    },
  });
  const issued = await issueInvoice(issuer, draft.id);
  await db.invoice.update({ where: { id: original.id }, data: { status: "CANCELLED" } });
  return issued;
}

/**
 * Marks an invoice as paid. For club invoices the payment is booked in the cash book
 * (income; a refunded cancellation becomes an expense).
 */
export async function markPaid(issuer: Issuer, id: string, paidOn: Date) {
  const issuerClubId = issuer.kind === "club" ? issuer.club.id : null;
  const invoice = await db.invoice.findFirst({ where: { id, issuerClubId, status: "ISSUED" } });
  if (!invoice) throw new InvoiceError("Nur offene Rechnungen können als bezahlt markiert werden.");
  await db.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status: "PAID", paidAt: paidOn } });
    if (issuer.kind === "club" && invoice.feeYear && invoice.recipientMemberId && invoice.kind === "INVOICE") {
      await bookFeePayment(tx, issuer.club.id, invoice.recipientMemberId, invoice.feeYear, invoice.grossCents, paidOn, id);
    } else if (issuer.kind === "club" && invoice.grossCents !== 0) {
      await tx.transaction.create({
        data: {
          clubId: issuer.club.id,
          invoiceId: id,
          memberId: invoice.recipientMemberId,
          type: invoice.grossCents > 0 ? "EINNAHME" : "AUSGABE",
          category: invoice.grossCents > 0 ? "Rechnungen" : "Rechnungen (Storno)",
          amount: Math.abs(invoice.grossCents) / 100,
          date: paidOn,
          description: `${invoice.kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung"} ${invoice.number} – ${invoice.recipientName}`,
        },
      });
    }
  });
}

/** Undo "paid" (e.g. wrong click): removes the cash book entry again. */
export async function unmarkPaid(issuer: Issuer, id: string) {
  const issuerClubId = issuer.kind === "club" ? issuer.club.id : null;
  const invoice = await db.invoice.findFirst({ where: { id, issuerClubId, status: "PAID" } });
  if (!invoice) throw new InvoiceError("Die Rechnung ist nicht als bezahlt markiert.");
  await db.$transaction([
    db.transaction.deleteMany({ where: { invoiceId: id } }),
    db.invoice.update({ where: { id }, data: { status: "ISSUED", paidAt: null } }),
    // a paid fee invoice marked the member's fee as paid
    ...(invoice.feeYear && invoice.recipientMemberId
      ? [db.member.updateMany({ where: { id: invoice.recipientMemberId, feePaidYear: invoice.feeYear }, data: { feePaidYear: null } })]
      : []),
  ]);
}

/**
 * Books a membership fee as paid: the member's fee flag for the year plus the fee booking in the cash book.
 * A booking that already exists (fee marked paid at the member) is linked to the invoice instead of booked twice.
 */
export async function bookFeePayment(
  tx: Prisma.TransactionClient,
  clubId: string,
  memberId: string,
  year: number,
  cents: number,
  paidOn: Date,
  invoiceId: string | null,
) {
  const member = await tx.member.findFirst({ where: { id: memberId, clubId } });
  if (!member) return;
  if (year >= (member.feePaidYear ?? 0)) await tx.member.update({ where: { id: memberId }, data: { feePaidYear: year } });
  if (cents <= 0) return;
  await tx.transaction.upsert({
    where: { memberId_feeYear: { memberId, feeYear: year } },
    update: invoiceId ? { invoiceId } : {},
    create: {
      clubId,
      memberId,
      feeYear: year,
      invoiceId,
      type: "EINNAHME",
      category: "Mitgliedsbeitrag",
      amount: cents / 100,
      date: paidOn,
      description: `Beitrag ${year} – ${member.firstName} ${member.lastName}`,
    },
  });
}

/** Draft for a license renewal or new license from a plan with a price (platform → club). */
export async function draftForLicense(
  license: { id: string; clubId: string | null; validFrom: Date | null; validUntil: Date | null; name: string },
  plan: { name: string; priceCents: number | null },
  from?: Date,
) {
  if (!license.clubId || !plan.priceCents) return null;
  const club = await db.club.findUnique({ where: { id: license.clubId }, include: { users: { where: { role: "ADMIN" }, take: 1 } } });
  if (!club) return null;
  const issuer = await platformIssuer();
  const { taxMode } = issuerSettings(issuer);
  const rate = taxMode === "STEUERPFLICHTIG" ? 20 : 0;
  const { start: periodStart, end } = licensePeriod(license.validFrom, license.validUntil, viennaYear());
  const start = from ?? periodStart;
  const period = start ? `${formatDate(start)} – ${formatDate(end)}` : `bis ${formatDate(end)}`;
  return saveDraft(
    issuer,
    {
      recipientClubId: club.id,
      recipientName: club.name,
      recipientAddress: club.address,
      recipientEmail: club.email ?? club.users[0]?.email ?? null,
      recipientVatId: club.vatId,
      servicePeriod: period,
      intro: null,
      notes: null,
      items: [
        {
          description: `Lizenz „${plan.name}“${period ? ` (${period})` : ""}`,
          quantity: 1,
          unit: "Pauschale",
          unitCents: rate ? netFromGross(plan.priceCents, rate) : plan.priceCents,
          taxRate: rate,
        },
      ],
    },
    undefined,
    { licenseId: license.id, licensePeriodEnd: end },
  );
}

/** Sends the invoice (or a payment reminder) as PDF attachment. Returns false if the mail could not be sent. */
export async function sendInvoiceMail(issuer: Issuer, invoice: InvoiceWithItems, opts: { reminder?: boolean; to?: string } = {}) {
  const { renderInvoicePdf } = await import("@/lib/invoice-pdf");
  const { trySendMail } = await import("@/lib/mail");
  const { mailBrand } = await import("@/lib/branding");
  const to = opts.to ?? invoice.recipientEmail;
  if (!to) throw new InvoiceError("Für diesen Empfänger ist keine E-Mail-Adresse hinterlegt.");
  const snapshot = (invoice.issuerSnapshot as IssuerSnapshot | null) ?? snapshotOf(issuer);
  const pdf = Buffer.from(await renderInvoicePdf(invoice, snapshot));
  const label = invoice.kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung";
  const amount = formatEurPlain(invoice.grossCents);
  const text = opts.reminder
    ? `Guten Tag,\n\nzu unserer ${label} ${invoice.number} vom ${formatDate(invoice.issueDate)} über ${amount} konnten wir noch keinen Zahlungseingang feststellen. Wir bitten um Überweisung – die Rechnung liegt nochmals bei.\n\nSollte sich die Zahlung mit dieser Nachricht überschnitten haben, betrachte sie bitte als gegenstandslos.\n\nMit freundlichen Grüßen\n${snapshot.name}`
    : `Guten Tag,\n\nanbei erhältst du unsere ${label} ${invoice.number} über ${amount}${invoice.kind === "INVOICE" && invoice.dueDate ? `, zahlbar bis ${formatDate(invoice.dueDate)}` : ""}.\n\nMit freundlichen Grüßen\n${snapshot.name}`;
  const sent = await trySendMail({
    to,
    subject: `${opts.reminder ? "Zahlungserinnerung: " : ""}${label} ${invoice.number}`,
    text,
    replyTo: snapshot.email,
    brand: issuer.kind === "club" ? mailBrand(issuer.club) : null,
    attachments: [{ filename: `${invoice.number}.pdf`, content: pdf, contentType: "application/pdf" }],
  });
  if (sent) await db.invoice.update({ where: { id: invoice.id }, data: opts.reminder ? { remindedAt: new Date() } : { sentAt: new Date() } });
  return sent;
}

function formatEurPlain(cents: number) {
  return new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(cents / 100);
}
