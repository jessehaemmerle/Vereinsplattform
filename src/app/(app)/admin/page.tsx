import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { isLicenseActive } from "@/lib/license";
import { formatDate } from "@/lib/format";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Table, Td } from "@/components/ui/misc";
import { AdminTabs } from "./nav";

export const metadata = { title: "Plattform" };

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000);
}

export default async function AdminPage() {
  await requirePlatformAdmin();
  const since = daysAgo(30);
  const [clubs, activity] = await Promise.all([
    db.club.findMany({ orderBy: { name: "asc" }, include: { licenses: true, _count: { select: { members: true, users: true } } } }),
    db.activity.groupBy({ by: ["clubId"], where: { createdAt: { gte: since } }, _count: true }),
  ]);
  const act = new Map(activity.map((a) => [a.clubId, a._count]));
  return (
    <>
      <PageHeader
        title="Plattform"
        description={`${clubs.length} Vereine`}
        actions={
          <LinkButton href="/admin/vereine/neu">
            <Plus className="size-4" /> Verein anlegen
          </LinkButton>
        }
      />
      <AdminTabs active="vereine" />
      {clubs.length === 0 ? (
        <EmptyState title="Noch kein Verein" action={<LinkButton href="/admin/vereine/neu">Ersten Verein anlegen</LinkButton>}>
          Lege einen Verein samt Vereins-Admin an. Danach erstellst du eine Lizenz und weist sie zu.
        </EmptyState>
      ) : (
        <Table head={["Verein", "Lizenz", "Mitglieder", "Zugänge", "Aktivität 30 Tage", "Angelegt"]}>
          {clubs.map((c) => {
            const license = c.licenses.find((l) => isLicenseActive(l));
            return (
              <tr key={c.id}>
                <Td>
                  <Link href={`/admin/vereine/${c.id}`} className="hover:text-loden font-medium hover:underline">
                    {c.name}
                  </Link>
                </Td>
                <Td>{license ? <Badge tone={license.status === "TRIAL" ? "warn" : "ok"}>{license.name}</Badge> : <Badge tone="danger">keine</Badge>}</Td>
                <Td>
                  {c._count.members}
                  {license?.maxMembers ? <span className="text-muted"> / {license.maxMembers}</span> : null}
                </Td>
                <Td>{c._count.users}</Td>
                <Td>{act.get(c.id) ?? 0}</Td>
                <Td className="text-muted">{formatDate(c.createdAt)}</Td>
              </tr>
            );
          })}
        </Table>
      )}
    </>
  );
}
