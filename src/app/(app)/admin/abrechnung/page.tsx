import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { licenseBillingRows } from "@/lib/billing";
import { formatEur } from "@/lib/format";
import { getPlatformSettings } from "@/lib/legal";
import { missingIssuerData, platformIssuer, snapshotOf } from "@/lib/invoices";
import { Badge, EmptyState, Notice, PageHeader, Table, Td } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { InvoiceStatus } from "@/components/invoices/invoice-views";
import { BillingRunForm, RowCheckbox, SelectAll } from "@/components/invoices/billing-run";
import { runLicenseBilling } from "../rechnungen/actions";

export const metadata = { title: "Abrechnung" };

const LICENSE_STATUS = { ACTIVE: "aktiv", TRIAL: "Test", SUSPENDED: "gesperrt", EXPIRED: "abgelaufen" } as const;

export default async function BillingRunPage({ searchParams }: { searchParams: Promise<{ alle?: string }> }) {
  await requirePlatformAdmin();
  const { alle } = await searchParams;
  const [rows, settings] = await Promise.all([licenseBillingRows(), getPlatformSettings()]);
  const missing = missingIssuerData(snapshotOf(await platformIssuer()), settings.taxMode);
  const open = rows.filter((r) => r.billable);
  const shown = alle ? rows : open;
  const sum = open.reduce((a, r) => a + (r.priceCents ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Abrechnung"
        description={
          open.length
            ? `${open.length} Lizenzen sind für ihre aktuelle Laufzeit noch nicht verrechnet (${formatEur(sum / 100)}).`
            : "Alle aktiven Lizenzen mit Preis sind für ihre aktuelle Laufzeit verrechnet."
        }
      />
      <p className="text-muted mb-4 max-w-3xl text-sm">
        Je Lizenz wird die aktuelle Laufzeit verrechnet, bei unbefristeten Lizenzen das laufende Kalenderjahr. Der Preis kommt aus dem Paket. Für Test-, gesperrte
        und abgelaufene Lizenzen entsteht keine Rechnung. Einzelne Rechnungen ohne Paket schreibst du unter{" "}
        <Link href="/admin/rechnungen/neu" className="text-loden underline">
          Rechnungen
        </Link>
        .
      </p>
      {missing.length > 0 && (
        <div className="mb-4">
          <Notice tone="warn">
            Zum Ausstellen fehlen noch: {missing.join(", ")}. Entwürfe kannst du trotzdem erstellen. Ergänzen unter{" "}
            <Link href="/admin/rechtliches" className="underline">
              Rechtliches
            </Link>{" "}
            bzw.{" "}
            <Link href="/admin/rechnungen/einstellungen" className="underline">
              Rechnungseinstellungen
            </Link>
            .
          </Notice>
        </div>
      )}
      <div className="mb-4 flex gap-1 text-sm">
        <Link href="/admin/abrechnung" className={`rounded-md px-3 py-1.5 ${!alle ? "bg-loden-soft text-loden font-medium" : "text-muted hover:text-ink"}`}>
          Offen ({open.length})
        </Link>
        <Link href="/admin/abrechnung?alle=1" className={`rounded-md px-3 py-1.5 ${alle ? "bg-loden-soft text-loden font-medium" : "text-muted hover:text-ink"}`}>
          Alle Lizenzen ({rows.length})
        </Link>
      </div>
      {shown.length === 0 ? (
        <EmptyState title={alle ? "Noch keine Lizenzen mit Verein" : "Nichts zu verrechnen"}>
          {!alle && "Neue Rechnungen entstehen auch automatisch als Entwurf, wenn du eine Lizenz aus einem Paket erstellst oder verlängerst."}
        </EmptyState>
      ) : (
        <BillingRunForm action={runLicenseBilling} submitLabel="Rechnungen erzeugen" selectable={open.length}>
          <Table
            head={[
              open.length ? <SelectAll key="all" /> : "",
              "Verein",
              "Lizenz",
              "Laufzeit",
              <span key="p" className="block text-right">
                Preis
              </span>,
              "Rechnung",
              "",
            ]}
          >
            {shown.map((r) => (
              <tr key={r.license.id}>
                <Td className="w-8">{r.billable && <RowCheckbox value={r.license.id} label={`${r.license.club?.name} auswählen`} />}</Td>
                <Td>
                  <Link href={`/admin/vereine/${r.license.club?.id}`} className="font-medium hover:underline">
                    {r.license.club?.name}
                  </Link>
                </Td>
                <Td>
                  <Link href={`/admin/lizenzen/${r.license.id}`} className="hover:underline">
                    {r.license.name}
                  </Link>
                  <span className="text-muted block text-xs">
                    {r.license.plan ? `Paket ${r.license.plan.name}` : "ohne Paket"} · {LICENSE_STATUS[r.license.status]}
                  </span>
                </Td>
                <Td className="whitespace-nowrap">{r.periodLabel}</Td>
                <Td className="text-right whitespace-nowrap">{r.priceCents ? formatEur(r.priceCents / 100) : <span className="text-muted">kein Preis</span>}</Td>
                <Td>
                  {r.invoice ? (
                    <Link href={`/admin/rechnungen/${r.invoice.id}`} className="inline-flex items-center gap-2 hover:underline">
                      <span className="font-mono text-sm">{r.invoice.number ?? "Entwurf"}</span>
                      <InvoiceStatus invoice={{ status: r.invoice.status, kind: "INVOICE", dueDate: null }} />
                    </Link>
                  ) : r.billable ? (
                    <Badge tone="warn">nicht verrechnet</Badge>
                  ) : (
                    <span className="text-muted text-sm">–</span>
                  )}
                </Td>
                <Td className="text-right">
                  {r.billable && (
                    <Button type="submit" name="only" value={r.license.id} variant="secondary" size="sm">
                      Rechnung erzeugen
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </Table>
        </BillingRunForm>
      )}
    </>
  );
}
