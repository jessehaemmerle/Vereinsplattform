import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { isLicenseActive } from "@/lib/license";
import { formatDate } from "@/lib/format";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Table, Td } from "@/components/ui/misc";

export const metadata = { title: "Lizenzen" };

const STATUS = { ACTIVE: "Aktiv", TRIAL: "Test", SUSPENDED: "Gesperrt", EXPIRED: "Abgelaufen" } as const;

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export default async function LicensesPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requirePlatformAdmin();
  const { filter } = await searchParams;
  const all = await db.license.findMany({
    orderBy: [{ validUntil: "asc" }, { createdAt: "desc" }],
    include: { plan: true, club: { include: { _count: { select: { members: true } } } } },
  });
  const licenses = filter === "bald" ? all.filter((l) => isLicenseActive(l) && l.validUntil && daysUntil(l.validUntil) <= 30) : all;
  const tab = (key: string | undefined, label: string) => (
    <Link
      href={key ? `/admin/lizenzen?filter=${key}` : "/admin/lizenzen"}
      className={`rounded-md px-3 py-1.5 ${filter === key ? "bg-loden-soft text-loden font-medium" : "text-muted hover:text-ink"}`}
    >
      {label}
    </Link>
  );
  return (
    <>
      <PageHeader
        title="Lizenzen"
        description={`${all.length} Lizenzen`}
        actions={
          <LinkButton href="/admin/lizenzen/neu">
            <Plus className="size-4" /> Lizenz erstellen
          </LinkButton>
        }
      />
      <div className="mb-4 flex gap-1 text-sm">
        {tab(undefined, "Alle")}
        {tab("bald", "Läuft in 30 Tagen ab")}
      </div>
      {licenses.length === 0 ? (
        <EmptyState title={filter ? "Keine Lizenz läuft in den nächsten 30 Tagen ab" : "Noch keine Lizenzen"} />
      ) : (
        <Table head={["Lizenz", "Verein", "Status", "Auslastung", "Gültig bis"]}>
          {licenses.map((l) => {
            const active = isLicenseActive(l);
            const left = l.validUntil ? daysUntil(l.validUntil) : null;
            return (
              <tr key={l.id}>
                <Td>
                  <Link href={`/admin/lizenzen/${l.id}`} className="hover:text-loden font-medium hover:underline">
                    {l.name}
                  </Link>
                  <span className="text-muted block font-mono text-xs">{l.key}</span>
                </Td>
                <Td>
                  {l.club ? (
                    <Link href={`/admin/vereine/${l.club.id}`} className="hover:underline">
                      {l.club.name}
                    </Link>
                  ) : (
                    <span className="text-muted">nicht zugewiesen</span>
                  )}
                </Td>
                <Td>
                  <Badge tone={active ? (l.status === "TRIAL" ? "warn" : "ok") : "danger"}>
                    {STATUS[l.status]}
                    {!active && (l.status === "ACTIVE" || l.status === "TRIAL") ? ", außerhalb Laufzeit" : ""}
                  </Badge>
                  {l.plan && <span className="text-muted block text-xs">Paket {l.plan.name}</span>}
                </Td>
                <Td>{l.club ? `${l.club._count.members} / ${l.maxMembers ?? "∞"}` : "–"}</Td>
                <Td className={left !== null && left <= 30 && active ? "text-brass font-medium" : "text-muted"}>
                  {l.validUntil ? formatDate(l.validUntil) : "unbegrenzt"}
                  {left !== null && active && left <= 30 && <span className="block text-xs">noch {left} Tage</span>}
                </Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
