import Link from "next/link";
import { notFound } from "next/navigation";
import { staff } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { feeBillingRows } from "@/lib/billing";
import { formatEur, toNumber, viennaYear } from "@/lib/format";
import { missingIssuerData, snapshotOf } from "@/lib/invoices";
import { Badge, EmptyState, Notice, PageHeader, Table, Td } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { InvoiceStatus } from "@/components/invoices/invoice-views";
import { BillingRunForm, RowCheckbox, SelectAll } from "@/components/invoices/billing-run";
import { runFeeBilling } from "../actions";

export const metadata = { title: "Beitragsrechnungen" };

export default async function FeeInvoicesPage({ searchParams }: { searchParams: Promise<{ jahr?: string }> }) {
  const user = await staff("finance:read", "FINANZEN");
  if (!user.club.modules.includes("MITGLIEDER")) notFound();
  const current = viennaYear();
  const { jahr } = await searchParams;
  const parsed = Number(jahr);
  const year = Number.isInteger(parsed) && parsed >= current - 5 && parsed <= current + 1 ? parsed : current;
  const rows = await feeBillingRows(user.clubId, year);
  const canWrite = can(user.role, "invoices:write");
  const billable = canWrite ? rows.filter((r) => r.billable) : [];
  const sum = billable.reduce((a, r) => a + toNumber(r.member.fee), 0);
  const missing = missingIssuerData(snapshotOf({ kind: "club", club: user.club }), user.club.taxMode);
  const counts = {
    open: rows.filter((r) => r.invoice?.status === "ISSUED").length,
    paid: rows.filter((r) => r.paid).length,
  };

  return (
    <>
      <PageHeader
        title={`Beitragsrechnungen ${year}`}
        description={`Vorschreibung der Mitgliedsbeiträge. ${rows.length} Mitglieder mit Beitrag · ${counts.paid} bezahlt · ${counts.open} Rechnungen offen · ${billable.length} noch ohne Rechnung (${formatEur(sum)}).`}
      />
      <p className="text-muted mb-4 max-w-3xl text-sm">
        Jedes Mitglied mit Beitrag erhält eine Rechnung über seinen Jahresbeitrag. Wird sie als bezahlt markiert, gilt auch der Beitrag als bezahlt und landet einmal
        im Kassabuch. Umgekehrt schließt „Beitrag bezahlt“ beim Mitglied die offene Rechnung. Beträge ändern: beim Mitglied den Beitrag anpassen, bevor die Rechnung
        erstellt wird.
      </p>
      {canWrite && missing.length > 0 && (
        <div className="mb-4">
          <Notice tone="warn">
            Zum Ausstellen fehlen noch: {missing.join(", ")}. Entwürfe gehen trotzdem. Ergänzen unter{" "}
            <Link href="/einstellungen" className="underline">
              Einstellungen
            </Link>
            .
          </Notice>
        </div>
      )}
      <div className="mb-4 flex flex-wrap gap-1 text-sm">
        {[current - 1, current, current + 1].map((y) => (
          <Link
            key={y}
            href={`/rechnungen/beitraege?jahr=${y}`}
            className={`rounded-md px-3 py-1.5 ${y === year ? "bg-loden-soft text-loden font-medium" : "text-muted hover:text-ink"}`}
          >
            {y}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Kein Mitglied hat einen Beitrag hinterlegt">Den Jahresbeitrag trägst du beim Mitglied ein.</EmptyState>
      ) : (
        <BillingRunForm action={runFeeBilling} hidden={{ year: String(year) }} submitLabel="Beitragsrechnungen erstellen" selectable={billable.length}>
          <Table
            head={[
              billable.length ? <SelectAll key="all" /> : "",
              "Mitglied",
              <span key="b" className="block text-right">
                Beitrag
              </span>,
              "Beitrag bezahlt",
              "Rechnung",
              "",
            ]}
          >
            {rows.map(({ member, invoice, paid }) => {
              const rowBillable = canWrite && !invoice && !paid;
              return (
                <tr key={member.id}>
                  <Td className="w-8">{rowBillable && <RowCheckbox value={member.id} label={`${member.firstName} ${member.lastName} auswählen`} />}</Td>
                  <Td>
                    <Link href={`/mitglieder/${member.id}`} className="font-medium hover:underline">
                      {member.lastName} {member.firstName}
                    </Link>
                    {!member.email && <span className="text-muted block text-xs">keine E-Mail-Adresse</span>}
                  </Td>
                  <Td className="text-right whitespace-nowrap">{formatEur(member.fee)}</Td>
                  <Td>{paid ? <Badge tone="ok">bezahlt</Badge> : <Badge tone="warn">offen</Badge>}</Td>
                  <Td>
                    {invoice ? (
                      <Link href={`/rechnungen/${invoice.id}`} className="inline-flex items-center gap-2 hover:underline">
                        <span className="font-mono text-sm">{invoice.number ?? "Entwurf"}</span>
                        <InvoiceStatus invoice={{ status: invoice.status, kind: "INVOICE", dueDate: null }} />
                      </Link>
                    ) : (
                      <span className="text-muted text-sm">{paid ? "nicht nötig" : "–"}</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {rowBillable && (
                      <Button type="submit" name="only" value={member.id} variant="secondary" size="sm">
                        Rechnung erstellen
                      </Button>
                    )}
                  </Td>
                </tr>
              );
            })}
          </Table>
        </BillingRunForm>
      )}
    </>
  );
}
