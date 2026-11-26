import "server-only";
import type { Club } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDate, toNumber, viennaYear } from "@/lib/format";
import { licensePeriod, sameDay } from "@/lib/invoice-calc";
import {
  draftForLicense,
  InvoiceError,
  issueInvoice,
  issuerSettings,
  missingIssuerData,
  platformIssuer,
  saveDraft,
  sendInvoiceMail,
  snapshotOf,
  type Issuer,
} from "@/lib/invoices";

/** What a billing run does with the invoices it creates. */
export const RUN_MODES = ["draft", "issue", "issueSend"] as const;
export type RunMode = (typeof RUN_MODES)[number];

export type RunResult = { created: number; issued: number; sent: number; noEmail: number; mailFailed: number };

/** Issues (and optionally sends) freshly created drafts. Issuer data is checked once up front. */
async function finalize(issuer: Issuer, ids: string[], mode: RunMode): Promise<RunResult> {
  const result: RunResult = { created: ids.length, issued: 0, sent: 0, noEmail: 0, mailFailed: 0 };
  if (mode === "draft") return result;
  for (const id of ids) {
    const invoice = await issueInvoice(issuer, id);
    result.issued++;
    if (mode !== "issueSend") continue;
    if (!invoice.recipientEmail) {
      result.noEmail++;
      continue;
    }
    if (await sendInvoiceMail(issuer, invoice)) result.sent++;
    else result.mailFailed++;
  }
  return result;
}

function assertCanIssue(issuer: Issuer, mode: RunMode) {
  if (mode === "draft") return;
  const missing = missingIssuerData(snapshotOf(issuer), issuerSettings(issuer).taxMode);
  if (missing.length) throw new InvoiceError(`Für Rechnungen fehlen noch Angaben des Ausstellers: ${missing.join(", ")}. Es wurde nichts erstellt.`);
}

/** Summary sentence for a billing run. */
export function describeRun(r: RunResult, noun: string) {
  if (!r.created) return `Keine ${noun} erstellt – alle ausgewählten sind schon verrechnet.`;
  const parts = [r.issued ? `${r.created} ${noun} ausgestellt` : `${r.created} ${noun} als Entwurf erstellt`];
  if (r.sent) parts.push(`${r.sent} per E-Mail gesendet`);
  if (r.noEmail) parts.push(`${r.noEmail} ohne E-Mail-Adresse (bitte ausdrucken oder Adresse ergänzen)`);
  if (r.mailFailed) parts.push(`${r.mailFailed} konnten nicht gesendet werden`);
  return `${parts.join(", ")}.`;
}

// ---------------------------------------------------------------------------------------------
// Platform: subscription invoices for licenses

export async function licenseBillingRows() {
  const year = viennaYear();
  const licenses = await db.license.findMany({
    where: { clubId: { not: null } },
    include: {
      club: { select: { id: true, name: true, slug: true } },
      plan: { select: { name: true, priceCents: true } },
      invoices: {
        where: { kind: "INVOICE", status: { not: "CANCELLED" } },
        select: { id: true, status: true, number: true, licensePeriodEnd: true },
      },
    },
    orderBy: [{ validUntil: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });
  return licenses.map((license) => {
    const period = licensePeriod(license.validFrom, license.validUntil, year);
    const invoice = license.invoices.find((i) => sameDay(i.licensePeriodEnd, period.end)) ?? null;
    return {
      license,
      period,
      periodLabel: period.start ? `${formatDate(period.start)} – ${formatDate(period.end)}` : `bis ${formatDate(period.end)}`,
      priceCents: license.plan?.priceCents ?? null,
      invoice,
      billable: !invoice && !!license.plan?.priceCents && license.status === "ACTIVE",
    };
  });
}

export async function generateLicenseInvoices(licenseIds: string[], mode: RunMode) {
  const issuer = await platformIssuer();
  assertCanIssue(issuer, mode);
  const wanted = new Set(licenseIds);
  const rows = (await licenseBillingRows()).filter((r) => wanted.has(r.license.id) && r.billable);
  const ids: string[] = [];
  for (const { license } of rows) {
    const draft = await draftForLicense(license, license.plan!);
    if (draft) ids.push(draft.id);
  }
  return finalize(issuer, ids, mode);
}

// ---------------------------------------------------------------------------------------------
// Club: membership fee invoices (Soll-Rechnungen)

export async function feeBillingRows(clubId: string, year: number) {
  const members = await db.member.findMany({
    where: { clubId, status: { not: "AUSGETRETEN" }, fee: { gt: 0 } },
    include: {
      invoices: { where: { feeYear: year, kind: "INVOICE", status: { not: "CANCELLED" } }, select: { id: true, status: true, number: true } },
      transactions: { where: { feeYear: year }, select: { id: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return members.map((member) => {
    const invoice = member.invoices[0] ?? null;
    const paid = member.feePaidYear === year || member.transactions.length > 0;
    return { member, invoice, paid, billable: !invoice && !paid };
  });
}

export async function generateFeeInvoices(club: Club, year: number, memberIds: string[], mode: RunMode) {
  const issuer: Issuer = { kind: "club", club };
  assertCanIssue(issuer, mode);
  const wanted = new Set(memberIds);
  const rows = (await feeBillingRows(club.id, year)).filter((r) => wanted.has(r.member.id) && r.billable);
  const ids: string[] = [];
  for (const { member } of rows) {
    const address = [member.street, [member.zip, member.city].filter(Boolean).join(" ")].filter(Boolean).join("\n");
    const draft = await saveDraft(
      issuer,
      {
        recipientMemberId: member.id,
        recipientName: `${member.firstName} ${member.lastName}`,
        recipientAddress: address || null,
        recipientEmail: member.email || null,
        recipientVatId: null,
        servicePeriod: `01.01.${year} – 31.12.${year}`,
        intro: `Wir schreiben dir hiermit den Mitgliedsbeitrag für ${year} vor. Vielen Dank, dass du den Verein unterstützt!`,
        notes: null,
        // genuine membership fees are not a taxable service: no VAT line
        items: [{ description: `Mitgliedsbeitrag ${year}`, quantity: 1, unit: "Jahr", unitCents: Math.round(toNumber(member.fee) * 100), taxRate: 0 }],
      },
      undefined,
      { feeYear: year },
    );
    ids.push(draft.id);
  }
  return finalize(issuer, ids, mode);
}
