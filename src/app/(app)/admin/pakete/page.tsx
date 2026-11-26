import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Table, Td } from "@/components/ui/misc";
import { MODULE_LABELS } from "@/lib/modules";

export const metadata = { title: "Pakete" };

export default async function PlansPage() {
  await requirePlatformAdmin();
  const plans = await db.licensePlan.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { licenses: true } } } });
  return (
    <>
      <PageHeader
        title="Pakete"
        description="Vorlagen für Lizenzen: Limits, Laufzeit und enthaltene Module."
        actions={
          <LinkButton href="/admin/pakete/neu">
            <Plus className="size-4" /> Paket anlegen
          </LinkButton>
        }
      />
      {plans.length === 0 ? (
        <EmptyState title="Noch keine Pakete" action={<LinkButton href="/admin/pakete/neu">Paket anlegen</LinkButton>}>
          Zum Beispiel „Basis“ bis 100 Mitglieder ohne Nachrichten, „Plus“ bis 300 Mitglieder mit allen Modulen.
        </EmptyState>
      ) : (
        <Table head={["Paket", "Mitglieder", "Zugänge", "Laufzeit", "Module", "Lizenzen"]}>
          {plans.map((p) => (
            <tr key={p.id}>
              <Td>
                <Link href={`/admin/pakete/${p.id}`} className="hover:text-loden font-medium hover:underline">
                  {p.name}
                </Link>{" "}
                {!p.active && <Badge>inaktiv</Badge>}
                {p.description && <span className="text-muted block text-xs">{p.description}</span>}
              </Td>
              <Td>{p.maxMembers ?? "∞"}</Td>
              <Td>{p.maxUsers ?? "∞"}</Td>
              <Td>{p.durationMonths ? `${p.durationMonths} Monate` : "unbegrenzt"}</Td>
              <Td className="text-muted text-xs">{p.modules.map((m) => MODULE_LABELS[m]).join(", ")}</Td>
              <Td>{p._count.licenses}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
