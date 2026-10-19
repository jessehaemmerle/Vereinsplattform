import { viennaYear } from "@/lib/format";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Download, FileText, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatDate, formatEur } from "@/lib/format";
import { balance, categorySums, yearSummaries } from "@/lib/finance";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Panel, Table, Td } from "@/components/ui/misc";
import { cn } from "@/lib/cn";

export const metadata = { title: "Finanzen" };

const REPORTS = [
  { key: "jahresabschluss", label: "Jahresabschluss", desc: "Saldo, Summen je Kategorie und alle Buchungen des Jahres" },
  { key: "journal", label: "Buchungsjournal", desc: "Chronologisch mit laufendem Kassastand" },
  { key: "kategorien", label: "Summen nach Kategorie", desc: "Einnahmen und Ausgaben je Kategorie" },
  { key: "jahressaldo", label: "Jahressalden", desc: "Anfangs- und Endbestand aller Jahre" },
];

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ jahr?: string; typ?: string; kategorie?: string }> }) {
  const user = await staff("finance:read", "FINANZEN");
  const sp = await searchParams;
  const all = await db.transaction.findMany({ where: { clubId: user.clubId }, select: { type: true, amount: true, date: true, category: true } });
  const years = [...new Set([viennaYear(), ...all.map((t) => t.date.getUTCFullYear())])].sort((a, b) => b - a);
  const year = Number(sp.jahr) || years[0];

  const where: Prisma.TransactionWhereInput = { clubId: user.clubId, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } };
  if (sp.typ === "EINNAHME" || sp.typ === "AUSGABE") where.type = sp.typ;
  if (sp.kategorie) where.category = sp.kategorie;
  const rows = await db.transaction.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }], include: { member: true, event: true } });

  const summaries = yearSummaries(all, user.club.openingBalance);
  const current = summaries.find((s) => s.year === year) ?? {
    year,
    opening: balance(
      all.filter((t) => t.date.getUTCFullYear() < year),
      user.club.openingBalance,
    ),
    income: 0,
    expense: 0,
    closing: 0,
  };
  if (!summaries.find((s) => s.year === year)) current.closing = current.opening;
  const cats = categorySums(all.filter((t) => t.date.getUTCFullYear() === year));
  const canWrite = can(user.role, "finance:write");
  const categories = [...new Set(all.map((t) => t.category))].sort();

  return (
    <>
      <PageHeader
        title="Finanzen"
        description={`Kassabuch ${year}`}
        actions={
          <>
            <a href={`/api/finanzen/export?jahr=${year}`} className={buttonClass("secondary")}>
              <Download className="size-4" /> CSV {year}
            </a>
            {canWrite && (
              <LinkButton href="/finanzen/neu">
                <Plus className="size-4" /> Buchung erfassen
              </LinkButton>
            )}
          </>
        }
      />

      <div className="border-line bg-surface mb-8 grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-4">
        {[
          ["Anfangsbestand", current.opening, ""],
          ["Einnahmen", current.income, "text-ok"],
          ["Ausgaben", current.expense, "text-danger"],
          ["Kassastand", current.closing, "text-loden"],
        ].map(([label, value, tone], i) => (
          <div key={label as string} className={cn("border-line p-5", i > 0 && "sm:border-l", i % 2 === 1 && "border-l", i > 1 && "border-t sm:border-t-0")}>
            <p className="text-muted text-sm">{label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tracking-tight", tone as string)}>{formatEur(value as number)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          <form className="mb-4 flex flex-wrap gap-3">
            <select name="jahr" defaultValue={year} aria-label="Jahr" className="border-line bg-surface h-10 rounded-md border px-3">
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
            <select name="typ" defaultValue={sp.typ ?? ""} aria-label="Art" className="border-line bg-surface h-10 rounded-md border px-3">
              <option value="">Einnahmen und Ausgaben</option>
              <option value="EINNAHME">Nur Einnahmen</option>
              <option value="AUSGABE">Nur Ausgaben</option>
            </select>
            <select name="kategorie" defaultValue={sp.kategorie ?? ""} aria-label="Kategorie" className="border-line bg-surface h-10 rounded-md border px-3">
              <option value="">Alle Kategorien</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button className={buttonClass("secondary")}>Anzeigen</button>
          </form>
          {rows.length === 0 ? (
            <EmptyState title={`Keine Buchungen ${year}`} action={canWrite ? <LinkButton href="/finanzen/neu">Buchung erfassen</LinkButton> : undefined}>
              Mitgliedsbeiträge werden automatisch gebucht, sobald du sie bei den Mitgliedern als bezahlt markierst.
            </EmptyState>
          ) : (
            <Table
              head={[
                "Datum",
                "Beschreibung",
                "Kategorie",
                <span key="b" className="block text-right">
                  Betrag
                </span>,
              ]}
            >
              {rows.map((t) => (
                <tr key={t.id}>
                  <Td className="text-muted whitespace-nowrap">{formatDate(t.date)}</Td>
                  <Td>
                    {canWrite && !t.eventId && !t.feeYear ? (
                      <Link href={`/finanzen/${t.id}`} className="hover:text-loden hover:underline">
                        {t.description || t.category}
                      </Link>
                    ) : (
                      t.description || t.category
                    )}
                    {t.member && (
                      <span className="text-muted block text-xs">
                        {t.member.firstName} {t.member.lastName}
                      </span>
                    )}
                    {t.event && <span className="text-muted block text-xs">Termin: {t.event.title}</span>}
                  </Td>
                  <Td>
                    <Badge tone={t.type === "EINNAHME" ? "ok" : "danger"}>{t.category}</Badge>
                  </Td>
                  <Td className={cn("text-right font-medium whitespace-nowrap", t.type === "EINNAHME" ? "text-ok" : "text-danger")}>
                    {t.type === "EINNAHME" ? "+" : "−"} {formatEur(t.amount)}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        <div className="space-y-6">
          <Panel title="Berichte als PDF">
            <ul className="space-y-3">
              {REPORTS.map((r) => (
                <li key={r.key}>
                  <a href={`/api/finanzen/bericht/${r.key}?jahr=${year}`} className="group flex gap-3">
                    <FileText className="text-loden mt-0.5 size-4 shrink-0" />
                    <span>
                      <span className="font-medium group-hover:underline">
                        {r.label}
                        {r.key === "jahresabschluss" || r.key === "journal" || r.key === "kategorien" ? ` ${year}` : ""}
                      </span>
                      <span className="text-muted block text-sm">{r.desc}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={`Kategorien ${year}`}>
            {cats.length === 0 ? (
              <p className="text-muted text-sm">Noch keine Buchungen.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {cats.map((c) => (
                  <li key={c.type + c.category} className="flex justify-between gap-3">
                    <span>{c.category}</span>
                    <span className={c.type === "EINNAHME" ? "text-ok" : "text-danger"}>{formatEur(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
