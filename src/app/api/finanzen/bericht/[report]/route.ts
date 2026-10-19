import { viennaYear } from "@/lib/format";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiUser, forbidden } from "@/lib/api-auth";
import { formatDate, formatDateTime, formatEur, toNumber } from "@/lib/format";
import { categorySums, signedCents, TX_LABELS, yearSummaries } from "@/lib/finance";
import { renderReport, type Section } from "@/lib/pdf";

const txColumns = [
  { header: "Datum", width: 64 },
  { header: "Art", width: 58 },
  { header: "Kategorie", width: 100 },
  { header: "Beschreibung", width: 202 },
  { header: "Betrag", width: 75, align: "right" as const },
];

export async function GET(req: NextRequest, ctx: { params: Promise<{ report: string }> }) {
  const user = await apiUser("finance:read", "FINANZEN");
  if (!user) return forbidden();
  const { report } = await ctx.params;
  const year = Number(req.nextUrl.searchParams.get("jahr")) || viennaYear();
  const all = await db.transaction.findMany({ where: { clubId: user.clubId }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
  const summaries = yearSummaries(all, user.club.openingBalance);
  const inYear = all.filter((t) => t.date.getUTCFullYear() === year);
  const s = summaries.find((x) => x.year === year);
  const opening =
    s?.opening ?? (toNumber(user.club.openingBalance) * 100 + all.filter((t) => t.date.getUTCFullYear() < year).reduce((a, t) => a + signedCents(t), 0)) / 100;
  const subtitle = `${user.club.name} · erstellt am ${formatDateTime(new Date())}`;
  const txRow = (t: (typeof all)[number]) => [
    formatDate(t.date),
    TX_LABELS[t.type],
    t.category,
    t.description ?? "",
    `${t.type === "AUSGABE" ? "−" : ""}${formatEur(t.amount)}`,
  ];
  const catSection = (): Section => ({
    title: "Summen nach Kategorie",
    columns: [
      { header: "Kategorie", width: 260 },
      { header: "Art", width: 80 },
      { header: "Buchungen", width: 70, align: "right" },
      { header: "Summe", width: 89, align: "right" },
    ],
    rows: categorySums(inYear).map((c) => [c.category, TX_LABELS[c.type], String(c.count), formatEur(c.total)]),
  });
  const summary: [string, string][] = [
    ["Anfangsbestand", formatEur(opening)],
    ["Einnahmen", formatEur(s?.income ?? 0)],
    ["Ausgaben", formatEur(s?.expense ?? 0)],
    ["Endbestand", formatEur(s?.closing ?? opening)],
  ];

  let pdf: Uint8Array;
  let filename: string;
  switch (report) {
    case "jahresabschluss":
      filename = `jahresabschluss-${year}.pdf`;
      pdf = await renderReport({
        title: `Jahresabschluss ${year}`,
        subtitle,
        summary,
        sections: [catSection(), { title: "Alle Buchungen", columns: txColumns, rows: inYear.map(txRow) }],
      });
      break;
    case "journal": {
      filename = `buchungsjournal-${year}.pdf`;
      let running = Math.round(opening * 100);
      pdf = await renderReport({
        title: `Buchungsjournal ${year}`,
        subtitle,
        summary: [["Anfangsbestand", formatEur(opening)]],
        sections: [
          {
            columns: [...txColumns.slice(0, 3), { header: "Beschreibung", width: 132 }, txColumns[4], { header: "Stand", width: 70, align: "right" }],
            rows: inYear.map((t) => {
              running += signedCents(t);
              return [...txRow(t), formatEur(running / 100)];
            }),
          },
        ],
      });
      break;
    }
    case "kategorien":
      filename = `kategorien-${year}.pdf`;
      pdf = await renderReport({ title: `Summen nach Kategorie ${year}`, subtitle, summary, sections: [catSection()] });
      break;
    case "jahressaldo":
      filename = "jahressalden.pdf";
      pdf = await renderReport({
        title: "Jahressalden",
        subtitle,
        sections: [
          {
            columns: [
              { header: "Jahr", width: 60 },
              { header: "Anfangsbestand", width: 110, align: "right" },
              { header: "Einnahmen", width: 110, align: "right" },
              { header: "Ausgaben", width: 110, align: "right" },
              { header: "Endbestand", width: 109, align: "right" },
            ],
            rows: summaries.map((y) => [String(y.year), formatEur(y.opening), formatEur(y.income), formatEur(y.expense), formatEur(y.closing)]),
          },
        ],
      });
      break;
    default:
      return new Response("Unbekannter Bericht", { status: 404 });
  }
  return new Response(Buffer.from(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${filename}"`, "Cache-Control": "no-store" },
  });
}
