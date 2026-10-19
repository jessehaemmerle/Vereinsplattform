import { viennaYear } from "@/lib/format";
import Link from "next/link";
import type { MemberStatus, Prisma } from "@prisma/client";
import { Download, Plus, Upload } from "lucide-react";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatEur } from "@/lib/format";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Table, Td } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { STATUS_LABELS, STATUS_TONES } from "./schema";
import { toggleFee } from "./actions";

export const metadata = { title: "Mitglieder" };

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Alle außer Ausgetretene" },
  { value: "AKTIV", label: "Aktiv" },
  { value: "PASSIV", label: "Passiv" },
  { value: "EHRENMITGLIED", label: "Ehrenmitglieder" },
  { value: "AUSGETRETEN", label: "Ausgetreten" },
  { value: "offen", label: "Beitrag offen" },
];

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await staff("members:read", "MITGLIEDER");
  const { q = "", status = "" } = await searchParams;
  const year = viennaYear();

  const where: Prisma.MemberWhereInput = { clubId: user.clubId };
  if (status === "offen") Object.assign(where, { status: { not: "AUSGETRETEN" }, fee: { gt: 0 }, OR: [{ feePaidYear: null }, { feePaidYear: { not: year } }] });
  else if (status) where.status = status as MemberStatus;
  else where.status = { not: "AUSGETRETEN" };
  if (q.trim()) {
    const term = q.trim();
    where.AND = [
      {
        OR: [
          { firstName: { contains: term, mode: "insensitive" } },
          { lastName: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
          { city: { contains: term, mode: "insensitive" } },
        ],
      },
    ];
  }

  const [members, total] = await Promise.all([
    db.member.findMany({ where, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take: 500 }),
    db.member.count({ where: { clubId: user.clubId } }),
  ]);
  const canWrite = can(user.role, "members:write");
  const canFees = can(user.role, "fees:write");
  const back = `/mitglieder?${new URLSearchParams({ q, status }).toString()}`;

  return (
    <>
      <PageHeader
        title="Mitglieder"
        description={`${total} Mitglieder insgesamt. Beitragsstatus bezieht sich auf ${year}.`}
        actions={
          <>
            <a href="/api/mitglieder/export" className={buttonClass("secondary")}>
              <Download className="size-4" /> CSV
            </a>
            {canWrite && (
              <>
                <LinkButton href="/mitglieder/import" variant="secondary">
                  <Upload className="size-4" /> Importieren
                </LinkButton>
                <LinkButton href="/mitglieder/neu">
                  <Plus className="size-4" /> Mitglied anlegen
                </LinkButton>
              </>
            )}
          </>
        }
      />

      <form className="mb-5 flex flex-col gap-3 sm:flex-row" role="search">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name, E-Mail oder Ort suchen"
          aria-label="Suche"
          className="border-line bg-surface focus:border-loden h-10 flex-1 rounded-md border px-3 focus:outline-none"
        />
        <select name="status" defaultValue={status} aria-label="Filter" className="border-line bg-surface h-10 rounded-md border px-3">
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <button className={buttonClass("secondary")}>Anzeigen</button>
      </form>

      {members.length === 0 ? (
        <EmptyState
          title={total === 0 ? "Noch keine Mitglieder" : "Keine Treffer"}
          action={
            total === 0 && canWrite ? (
              <LinkButton href="/mitglieder/import" variant="secondary">
                CSV-Datei importieren
              </LinkButton>
            ) : undefined
          }
        >
          {total === 0 ? "Lege das erste Mitglied an oder importiere deine bestehende Liste als CSV." : "Ändere Suche oder Filter."}
        </EmptyState>
      ) : (
        <Table head={["Name", "Kontakt", "Status", "Funktion", "Beitrag", ""]}>
          {members.map((m) => {
            const paid = m.feePaidYear === year;
            return (
              <tr key={m.id} className="hover:bg-paper/60">
                <Td>
                  <Link href={`/mitglieder/${m.id}`} className="hover:text-loden font-medium hover:underline">
                    {m.lastName} {m.firstName}
                  </Link>
                </Td>
                <Td className="text-muted">
                  <div>{m.email}</div>
                  {m.phone && <div>{m.phone}</div>}
                </Td>
                <Td>
                  <Badge tone={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status]}</Badge>
                </Td>
                <Td className="text-muted">{m.function ?? "–"}</Td>
                <Td>
                  {Number(m.fee) === 0 ? (
                    <span className="text-muted">beitragsfrei</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {formatEur(m.fee)} <Badge tone={paid ? "ok" : "warn"}>{paid ? "bezahlt" : "offen"}</Badge>
                    </span>
                  )}
                </Td>
                <Td className="text-right">
                  {canFees && Number(m.fee) > 0 && m.status !== "AUSGETRETEN" && (
                    <ActionButton
                      action={toggleFee}
                      fields={{ id: m.id, back }}
                      variant={paid ? "ghost" : "secondary"}
                      confirm={paid ? "Zahlung zurücknehmen? Die automatische Buchung wird gelöscht." : undefined}
                    >
                      {paid ? "Zurücknehmen" : "Zahlung buchen"}
                    </ActionButton>
                  )}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
