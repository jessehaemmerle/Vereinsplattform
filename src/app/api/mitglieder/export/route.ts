import { viennaYear } from "@/lib/format";
import { db } from "@/lib/db";
import { apiUser, forbidden } from "@/lib/api-auth";
import { csvResponse } from "@/lib/csv";
import { CSV_COLUMNS } from "@/lib/member-csv";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS } from "@/app/(app)/mitglieder/schema";

export async function GET() {
  const user = await apiUser("members:read", "MITGLIEDER");
  if (!user) return forbidden();
  const members = await db.member.findMany({ where: { clubId: user.clubId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }] });
  const year = viennaYear();
  return csvResponse(`mitglieder-${new Date().toISOString().slice(0, 10)}.csv`, [
    [...CSV_COLUMNS, `Beitrag ${year} bezahlt`],
    ...members.map((m) => [
      m.firstName,
      m.lastName,
      m.email,
      m.phone,
      m.birthday ? formatDate(m.birthday) : "",
      m.street,
      m.zip,
      m.city,
      m.joinedAt ? formatDate(m.joinedAt) : "",
      STATUS_LABELS[m.status].toLowerCase(),
      m.function,
      m.fee.toFixed(2).replace(".", ","),
      m.feePaidYear === year ? "ja" : "nein",
    ]),
  ]);
}
