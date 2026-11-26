import Link from "next/link";
import { FileDown } from "lucide-react";
import type { Invoice, InvoiceItem } from "@prisma/client";
import { formatDate, formatDateTime, formatEur, toDateInput, viennaDay } from "@/lib/format";
import { Badge, Dl, Panel, Table, Td } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { buttonClass } from "@/components/ui/button";
import type { InvoiceDraft } from "./invoice-editor";

type Action = (formData: FormData) => Promise<void>;

export function isOverdue(i: Pick<Invoice, "status" | "dueDate" | "kind">) {
  return i.kind === "INVOICE" && i.status === "ISSUED" && !!i.dueDate && i.dueDate < viennaDay();
}

export function InvoiceStatus({ invoice }: { invoice: Pick<Invoice, "status" | "dueDate" | "kind"> }) {
  if (invoice.kind === "CANCELLATION") return <Badge tone="neutral">Storno</Badge>;
  if (invoice.status === "DRAFT") return <Badge>Entwurf</Badge>;
  if (invoice.status === "PAID") return <Badge tone="ok">bezahlt</Badge>;
  if (invoice.status === "CANCELLED") return <Badge tone="danger">storniert</Badge>;
  return isOverdue(invoice) ? <Badge tone="danger">überfällig</Badge> : <Badge tone="warn">offen</Badge>;
}

export function InvoiceTable({ invoices, basePath, showRecipient = true }: { invoices: Invoice[]; basePath: string; showRecipient?: boolean }) {
  return (
    <Table
      head={[
        "Nummer",
        ...(showRecipient ? ["Empfänger"] : []),
        "Datum",
        "Fällig",
        "Status",
        <span key="b" className="block text-right">
          Betrag
        </span>,
      ]}
    >
      {invoices.map((i) => (
        <tr key={i.id}>
          <Td>
            <Link href={`${basePath}/${i.id}`} className="hover:text-loden font-medium whitespace-nowrap hover:underline">
              {i.number ?? "Entwurf"}
            </Link>
          </Td>
          {showRecipient && <Td>{i.recipientName}</Td>}
          <Td className="text-muted whitespace-nowrap">{formatDate(i.issueDate ?? i.createdAt)}</Td>
          <Td className="text-muted whitespace-nowrap">{i.kind === "INVOICE" ? formatDate(i.dueDate) : "–"}</Td>
          <Td>
            <InvoiceStatus invoice={i} />
          </Td>
          <Td className="text-right font-medium whitespace-nowrap">{formatEur(i.grossCents / 100)}</Td>
        </tr>
      ))}
    </Table>
  );
}

export function toDraft(i: Invoice & { items: InvoiceItem[] }, recipientKey?: string): InvoiceDraft {
  const price = (c: number) => (c / 100).toFixed(2).replace(".", ",");
  return {
    recipientKey,
    recipientName: i.recipientName,
    recipientAddress: i.recipientAddress ?? "",
    recipientEmail: i.recipientEmail ?? "",
    recipientVatId: i.recipientVatId ?? "",
    servicePeriod: i.servicePeriod ?? "",
    intro: i.intro ?? "",
    notes: i.notes ?? "",
    items: [...i.items]
      .sort((a, b) => a.position - b.position)
      .map((it) => ({
        description: it.description,
        quantity: String(Number(it.quantity)).replace(".", ","),
        unit: it.unit ?? "",
        price: price(it.unitCents),
        taxRate: it.taxRate,
      })),
  };
}

/** Facts and actions of an issued invoice (drafts are edited in the editor). */
export function InvoiceSummary({
  invoice,
  action,
  canWrite,
  related,
  bookingNote,
}: {
  invoice: Invoice;
  action: Action;
  canWrite: boolean;
  related?: { href: string; label: string } | null;
  bookingNote?: string;
}) {
  const f = { id: invoice.id };
  const open = invoice.status === "ISSUED";
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Panel title="Rechnung">
        <Dl
          items={[
            ["Status", <InvoiceStatus key="s" invoice={invoice} />],
            [
              "Empfänger",
              <span key="r" className="whitespace-pre-line">
                {[invoice.recipientName, invoice.recipientAddress].filter(Boolean).join("\n")}
              </span>,
            ],
            ["E-Mail", invoice.recipientEmail],
            ["Rechnungsdatum", formatDate(invoice.issueDate)],
            ["Leistungszeitraum", invoice.servicePeriod],
            ...(invoice.kind === "INVOICE" ? ([["Fällig", formatDate(invoice.dueDate)]] as [string, string][]) : []),
            ["Betrag", <strong key="b">{formatEur(invoice.grossCents / 100)}</strong>],
            ...(invoice.taxCents ? ([["davon USt", formatEur(invoice.taxCents / 100)]] as [string, string][]) : []),
            ...(invoice.paidAt ? ([["Bezahlt am", formatDate(invoice.paidAt)]] as [string, string][]) : []),
            ["Versendet", invoice.sentAt ? formatDateTime(invoice.sentAt) : "noch nicht"],
            ...(invoice.remindedAt ? ([["Erinnert", formatDateTime(invoice.remindedAt)]] as [string, string][]) : []),
            ...(related
              ? ([
                  [
                    "Bezug",
                    <Link key="rel" href={related.href} className="text-loden hover:underline">
                      {related.label}
                    </Link>,
                  ],
                ] as [string, React.ReactNode][])
              : []),
          ]}
        />
        {bookingNote && <p className="text-muted mt-4 text-sm">{bookingNote}</p>}
      </Panel>
      <div className="space-y-4">
        <a href={`/api/rechnungen/${invoice.id}`} target="_blank" className={`${buttonClass("secondary")} w-full`}>
          <FileDown className="size-4" /> PDF öffnen
        </a>
        {canWrite && (
          <Panel title="Aktionen">
            <div className="flex flex-col items-stretch gap-2 [&_button]:w-full [&_form]:block">
              {invoice.recipientEmail && (
                <ActionButton action={action} fields={{ ...f, op: "send" }} size="md">
                  {invoice.sentAt ? "Erneut per E-Mail senden" : "Per E-Mail senden"}
                </ActionButton>
              )}
              {open && invoice.kind === "INVOICE" && invoice.recipientEmail && (
                <ActionButton action={action} fields={{ ...f, op: "remind" }} size="md" confirm="Zahlungserinnerung mit der Rechnung im Anhang senden?">
                  Zahlungserinnerung senden
                </ActionButton>
              )}
              {open && (
                <form action={action} className="border-line space-y-2 rounded-md border p-3">
                  <input type="hidden" name="id" value={invoice.id} />
                  <input type="hidden" name="op" value="paid" />
                  <label className="block text-sm">
                    {invoice.kind === "CANCELLATION" ? "Erstattet am" : "Bezahlt am"}
                    <input
                      type="date"
                      name="paidOn"
                      defaultValue={toDateInput(viennaDay())}
                      className="border-line bg-surface mt-1 block w-full rounded-md border px-2 py-1.5"
                    />
                  </label>
                  <button className={buttonClass("primary", "sm")}>
                    {invoice.kind === "CANCELLATION" ? "Als erstattet markieren" : "Als bezahlt markieren"}
                  </button>
                </form>
              )}
              {invoice.status === "PAID" && (
                <ActionButton
                  action={action}
                  fields={{ ...f, op: "unpaid" }}
                  size="md"
                  variant="ghost"
                  confirm="Zahlung zurücknehmen? Eine Kassabuch-Buchung wird wieder entfernt."
                >
                  Zahlung zurücknehmen
                </ActionButton>
              )}
              {invoice.kind === "INVOICE" && (invoice.status === "ISSUED" || invoice.status === "PAID") && (
                <ActionButton
                  action={action}
                  fields={{ ...f, op: "cancel" }}
                  size="md"
                  variant="danger"
                  confirm="Rechnung stornieren? Es wird eine Stornorechnung mit eigener Nummer erstellt. Das lässt sich nicht rückgängig machen."
                >
                  Stornieren
                </ActionButton>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}

export function DraftActions({ invoice, action, missing, hasEmail }: { invoice: Invoice; action: Action; missing: string[]; hasEmail: boolean }) {
  const f = { id: invoice.id };
  return (
    <div className="border-line bg-surface mb-6 flex flex-wrap items-center gap-3 rounded-lg border p-4">
      {missing.length > 0 ? (
        <p className="text-danger text-sm">Vor dem Ausstellen fehlen Angaben des Ausstellers: {missing.join(", ")}.</p>
      ) : (
        <>
          {hasEmail && (
            <ActionButton
              action={action}
              fields={{ ...f, op: "issueSend" }}
              variant="primary"
              size="md"
              confirm="Rechnung ausstellen und per E-Mail senden? Danach ist sie nicht mehr änderbar."
            >
              Ausstellen und senden
            </ActionButton>
          )}
          <ActionButton
            action={action}
            fields={{ ...f, op: "issue" }}
            variant={hasEmail ? "secondary" : "primary"}
            size="md"
            confirm="Rechnung ausstellen? Sie erhält eine Nummer und ist danach nicht mehr änderbar."
          >
            Nur ausstellen
          </ActionButton>
        </>
      )}
      <a href={`/api/rechnungen/${invoice.id}`} target="_blank" className={buttonClass("ghost")}>
        <FileDown className="size-4" /> Vorschau (PDF)
      </a>
      <span className="flex-1" />
      <ActionButton action={action} fields={{ ...f, op: "delete" }} variant="ghost" confirm="Entwurf löschen?">
        Entwurf löschen
      </ActionButton>
    </div>
  );
}
