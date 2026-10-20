import { viennaYear } from "@/lib/format";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiUser, forbidden } from "@/lib/api-auth";
import { csvResponse } from "@/lib/csv";
import { formatDate } from "@/lib/format";
import { TX_LABELS } from "@/lib/finance";

export async function GET(req: NextRequest) {
  const user = await apiUser("finance:read", "FINANZEN");
  if (!user) return forbidden();
  const year = Number(req.nextUrl.searchParams.get("jahr")) || viennaYear();
  const rows = await db.transaction.findMany({
    where: { clubId: user.clubId, date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) } },
    orderBy: { date: "asc" },
    include: { member: true },
  });
  return csvResponse(`buchungen-${year}.csv`, [
    ["Datum", "Art", "Kategorie", "Betrag", "Beschreibung", "Mitglied"],
    ...rows.map((t) => [
      formatDate(t.date),
      TX_LABELS[t.type],
      t.category,
      t.amount.toFixed(2).replace(".", ","),
      t.description,
      t.member ? `${t.member.firstName} ${t.member.lastName}` : "",
    ]),
  ]);
}
