import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { isLicenseActive } from "@/lib/license";
import { formatDate } from "@/lib/format";
import { baseDomain, clubUrl } from "@/lib/hosts";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Table, Td } from "@/components/ui/misc";

export const metadata = { title: "Vereine" };

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000);
}

export default async function AdminPage() {
  await requirePlatformAdmin();
  const [clubs, activity] = await Promise.all([
    db.club.findMany({ orderBy: { name: "asc" }, include: { licenses: { include: { plan: true } }, _count: { select: { members: true, users: true } } } }),
    db.activity.groupBy({ by: ["clubId"], where: { createdAt: { gte: daysAgo(30) } }, _count: true }),
  ]);
  const act = new Map(activity.map((a) => [a.clubId, a._count]));
  return (
    <>
      <PageHeader
        title="Vereine"
        description={`${clubs.length} Vereine auf ${baseDomain()}`}
        actions={
          <LinkButton href="/admin/vereine/neu">
            <Plus className="size-4" /> Verein anlegen
          </LinkButton>
        }
      />
      {clubs.length === 0 ? (
        <EmptyState title="Noch kein Verein" action={<LinkButton href="/admin/vereine/neu">Ersten Verein anlegen</LinkButton>}>
          Lege zuerst unter Pakete eure Angebote an, dann einen Verein samt Vereins-Admin.
        </EmptyState>
      ) : (
        <Table head={["Verein", "Adresse", "Lizenz", "Mitglieder", "Aktivität 30 Tage"]}>
          {clubs.map((c) => {
            const license = c.licenses.find((l) => isLicenseActive(l));
            const left = license?.validUntil ? daysUntil(license.validUntil) : null;
            return (
              <tr key={c.id}>
                <Td>
                  <Link href={`/admin/vereine/${c.id}`} className="hover:text-loden font-medium hover:underline">
                    {c.name}
                  </Link>
                </Td>
                <Td>
                  <a href={clubUrl(c.slug)} className="text-muted hover:text-loden text-sm hover:underline" target="_blank" rel="noreferrer">
                    {c.slug}.{baseDomain()}
                  </a>
                </Td>
                <Td>
                  {license ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={license.status === "TRIAL" ? "warn" : "ok"}>{license.plan?.name ?? license.name}</Badge>
                      {left !== null && <span className={left <= 30 ? "text-brass text-xs" : "text-muted text-xs"}>bis {formatDate(license.validUntil)}</span>}
                    </span>
                  ) : (
                    <Badge tone="danger">keine</Badge>
                  )}
                </Td>
                <Td>
                  {c._count.members}
                  {license?.maxMembers ? <span className="text-muted"> / {license.maxMembers}</span> : null}
                </Td>
                <Td>{act.get(c.id) ?? 0}</Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
