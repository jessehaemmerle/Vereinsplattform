import Link from "next/link";
import { BookUser, Plus, Settings } from "lucide-react";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatEur, viennaDay } from "@/lib/format";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { InvoiceTable } from "@/components/invoices/invoice-views";

export const metadata = { title: "Rechnungen" };

const FILTERS: [string, string][] = [
  ["", "Alle"],
  ["DRAFT", "Entwürfe"],
  ["offen", "Offen"],
  ["ueberfaellig", "Überfällig"],
  ["PAID", "Bezahlt"],
];

export default async function ClubInvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await staff("finance:read", "FINANZEN");
  const { status = "" } = await searchParams;
  const where: Prisma.InvoiceWhereInput = { issuerClubId: user.clubId };
  if (status === "offen") where.status = "ISSUED";
  else if (status === "ueberfaellig") Object.assign(where, { status: "ISSUED", kind: "INVOICE", dueDate: { lt: viennaDay() } });
  else if (status) where.status = status as InvoiceStatus;
  const [invoices, open] = await Promise.all([
    db.invoice.findMany({ where, orderBy: [{ issueDate: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }], take: 300 }),
    db.invoice.aggregate({ where: { issuerClubId: user.clubId, status: "ISSUED", kind: "INVOICE" }, _sum: { grossCents: true }, _count: true }),
  ]);
  const canWrite = can(user.role, "invoices:write");
  return (
    <>
      <PageHeader
        title="Rechnungen"
        description={`Rechnungen des Vereins an Sponsoren, Gemeinden, Firmen oder Mitglieder. ${open._count} offen (${formatEur((open._sum.grossCents ?? 0) / 100)}). Bezahlte Rechnungen landen automatisch im Kassabuch.`}
        actions={
          canWrite && (
            <>
              <LinkButton href="/rechnungen/kontakte" variant="secondary">
                <BookUser className="size-4" /> Adressbuch
              </LinkButton>
              {can(user.role, "club:manage") && (
                <LinkButton href="/rechnungen/einstellungen" variant="secondary">
                  <Settings className="size-4" /> Einstellungen
                </LinkButton>
              )}
              <LinkButton href="/rechnungen/neu">
                <Plus className="size-4" /> Rechnung schreiben
              </LinkButton>
            </>
          )
        }
      />
      <div className="mb-4 flex flex-wrap gap-1 text-sm">
        {FILTERS.map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/rechnungen?status=${value}` : "/rechnungen"}
            className={`rounded-md px-3 py-1.5 ${status === value ? "bg-loden-soft text-loden font-medium" : "text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {invoices.length === 0 ? (
        <EmptyState
          title="Keine Rechnungen in dieser Ansicht"
          action={canWrite && !status ? <LinkButton href="/rechnungen/neu">Erste Rechnung schreiben</LinkButton> : undefined}
        >
          Zum Beispiel für Sponsoring, einen Auftritt bei einer Gemeindefeier oder die Saalmiete an einen anderen Verein.
        </EmptyState>
      ) : (
        <InvoiceTable invoices={invoices} basePath="/rechnungen" />
      )}
    </>
  );
}
