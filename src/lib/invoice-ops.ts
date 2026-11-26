import "server-only";
import { db } from "@/lib/db";
import { cancelInvoice, InvoiceError, issueInvoice, markPaid, sendInvoiceMail, unmarkPaid, type Issuer } from "@/lib/invoices";
import { viennaDay } from "@/lib/format";

export const INVOICE_OPS = ["issue", "issueSend", "send", "remind", "paid", "unpaid", "cancel", "delete"] as const;
export type InvoiceOp = (typeof INVOICE_OPS)[number];

/** Runs one invoice action for an issuer and returns a user-facing message. Scoping to the issuer happens in every query. */
export async function runInvoiceOp(issuer: Issuer, op: InvoiceOp, id: string, paidOn?: string): Promise<{ ok?: string; error?: string; deleted?: boolean }> {
  const issuerClubId = issuer.kind === "club" ? issuer.club.id : null;
  const load = () => db.invoice.findFirst({ where: { id, issuerClubId }, include: { items: true } });
  try {
    switch (op) {
      case "issue": {
        const inv = await issueInvoice(issuer, id);
        return { ok: `Rechnung ${inv.number} ausgestellt.` };
      }
      case "issueSend": {
        const inv = await issueInvoice(issuer, id);
        const sent = await sendInvoiceMail(issuer, inv);
        return sent
          ? { ok: `Rechnung ${inv.number} ausgestellt und an ${inv.recipientEmail} gesendet.` }
          : { error: `Rechnung ${inv.number} ausgestellt, aber die E-Mail konnte nicht gesendet werden.` };
      }
      case "send":
      case "remind": {
        const inv = await load();
        if (!inv || inv.status === "DRAFT") return { error: "Nur ausgestellte Rechnungen können versendet werden." };
        if (op === "remind" && inv.status !== "ISSUED") return { error: "Eine Erinnerung ist nur für offene Rechnungen möglich." };
        const sent = await sendInvoiceMail(issuer, inv, { reminder: op === "remind" });
        if (!sent) return { error: "Die E-Mail konnte nicht gesendet werden – bitte den Mailversand prüfen." };
        return { ok: op === "remind" ? `Zahlungserinnerung an ${inv.recipientEmail} gesendet.` : `Rechnung an ${inv.recipientEmail} gesendet.` };
      }
      case "paid": {
        const date = paidOn && /^\d{4}-\d{2}-\d{2}$/.test(paidOn) ? new Date(`${paidOn}T00:00:00Z`) : viennaDay();
        await markPaid(issuer, id, date);
        return { ok: issuer.kind === "club" ? "Als bezahlt markiert – die Buchung steht im Kassabuch." : "Als bezahlt markiert." };
      }
      case "unpaid":
        await unmarkPaid(issuer, id);
        return { ok: "Wieder auf offen gesetzt." };
      case "cancel": {
        const storno = await cancelInvoice(issuer, id);
        return { ok: `Stornorechnung ${storno.number} erstellt.` };
      }
      case "delete": {
        const { count } = await db.invoice.deleteMany({ where: { id, issuerClubId, status: "DRAFT" } });
        return count
          ? { ok: "Entwurf gelöscht.", deleted: true }
          : { error: "Nur Entwürfe können gelöscht werden – ausgestellte Rechnungen werden storniert." };
      }
    }
  } catch (e) {
    if (e instanceof InvoiceError) return { error: e.message };
    throw e;
  }
}
