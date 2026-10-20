import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { isLicenseActive } from "@/lib/license";
import { formatDate } from "@/lib/format";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Table, Td } from "@/components/ui/misc";
import { AdminTabs } from "../nav";

export const metadata = { title: "Lizenzen" };

const STATUS = { ACTIVE: "Aktiv", TRIAL: "Test", SUSPENDED: "Gesperrt", EXPIRED: "Abgelaufen" } as const;

export default async function LicensesPage() {
  await requirePlatformAdmin();
  const licenses = await db.license.findMany({ orderBy: { createdAt: "desc" }, include: { club: { include: { _count: { select: { members: true } } } } } });
  return (
    <>
      <PageHeader
        title="Plattform"
        description={`${licenses.length} Lizenzen`}
        actions={
          <LinkButton href="/admin/lizenzen/neu">
            <Plus className="size-4" /> Lizenz erstellen
          </LinkButton>
        }
      />
      <AdminTabs active="lizenzen" />
      {licenses.length === 0 ? (
        <EmptyState title="Noch keine Lizenzen" action={<LinkButton href="/admin/lizenzen/neu">Lizenz erstellen</LinkButton>} />
      ) : (
        <Table head={["Lizenz", "Schlüssel", "Verein", "Status", "Auslastung", "Gültig bis"]}>
          {licenses.map((l) => (
            <tr key={l.id}>
              <Td>
                <Link href={`/admin/lizenzen/${l.id}`} className="hover:text-loden font-medium hover:underline">
                  {l.name}
                </Link>
              </Td>
              <Td className="font-mono text-xs">{l.key}</Td>
              <Td>{l.club?.name ?? <span className="text-muted">nicht zugewiesen</span>}</Td>
              <Td>
                <Badge tone={isLicenseActive(l) ? "ok" : "danger"}>
                  {STATUS[l.status]}
                  {!isLicenseActive(l) && (l.status === "ACTIVE" || l.status === "TRIAL") ? ", außerhalb Laufzeit" : ""}
                </Badge>
              </Td>
              <Td>{l.club ? `${l.club._count.members} / ${l.maxMembers ?? "∞"}` : "–"}</Td>
              <Td className="text-muted">{l.validUntil ? formatDate(l.validUntil) : "unbegrenzt"}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
