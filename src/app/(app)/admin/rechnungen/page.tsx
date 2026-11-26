import Link from "next/link";
import { Plus, Settings } from "lucide-react";
import type { InvoiceStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
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

export default async function PlatformInvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePlatformAdmin();
  const { status = "" } = await searchParams;
  const where: Prisma.InvoiceWhereInput = { issuerClubId: null };
  if (status === "offen") where.status = "ISSUED";
  else if (status === "ueberfaellig") Object.assign(where, { status: "ISSUED", kind: "INVOICE", dueDate: { lt: viennaDay() } });
  else if (status) where.status = status as InvoiceStatus;
  const [invoices, open] = await Promise.all([
    db.invoice.findMany({ where, orderBy: [{ issueDate: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }], take: 300 }),
    db.invoice.aggregate({ where: { issuerClubId: null, status: "ISSUED", kind: "INVOICE" }, _sum: { grossCents: true }, _count: true }),
  ]);
  return (
    <>
      <PageHeader
        title="Rechnungen"
        description={`${open._count} offen · ${formatEur((open._sum.grossCents ?? 0) / 100)} ausständig. Beim Erstellen oder Verlängern einer Lizenz aus einem Paket mit Preis entsteht automatisch ein Entwurf.`}
        actions={
          <>
            <LinkButton href="/admin/rechnungen/einstellungen" variant="secondary">
              <Settings className="size-4" /> Einstellungen
            </LinkButton>
            <LinkButton href="/admin/rechnungen/neu">
              <Plus className="size-4" /> Rechnung erstellen
            </LinkButton>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1 text-sm">
        {FILTERS.map(([value, label]) => (
          <Link
            key={value}
            href={value ? `/admin/rechnungen?status=${value}` : "/admin/rechnungen"}
            className={`rounded-md px-3 py-1.5 ${status === value ? "bg-loden-soft text-loden font-medium" : "text-muted hover:text-ink"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {invoices.length === 0 ? <EmptyState title="Keine Rechnungen in dieser Ansicht" /> : <InvoiceTable invoices={invoices} basePath="/admin/rechnungen" />}
    </>
  );
}
