import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { isLicenseActive } from "@/lib/license";
import { ROLE_LABELS } from "@/lib/permissions";
import { formatDate, formatDateTime } from "@/lib/format";
import { Badge, Dl, PageHeader, Panel } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { Button, LinkButton } from "@/components/ui/button";
import { ModulesForm } from "../../forms";
import { deleteClub, resendAdminInvite, updateModules } from "../../actions";

export default async function ClubAdminPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const club = await db.club.findUnique({
    where: { id },
    include: {
      licenses: true,
      users: { where: { role: { not: "MITGLIED" } }, orderBy: { name: "asc" } },
      _count: { select: { members: true, transactions: true, events: true, documents: true } },
    },
  });
  if (!club) notFound();
  const activity = await db.activity.findMany({ where: { clubId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { user: true } });

  return (
    <>
      <PageHeader
        title={club.name}
        description={`Angelegt am ${formatDate(club.createdAt)}`}
        actions={
          <LinkButton href="/admin" variant="ghost">
            Zur Übersicht
          </LinkButton>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Kennzahlen">
          <Dl
            items={[
              ["Mitglieder", club._count.members],
              ["Buchungen", club._count.transactions],
              ["Termine", club._count.events],
              ["Dokumente", club._count.documents],
            ]}
          />
        </Panel>
        <Panel
          title="Lizenzen"
          actions={
            <LinkButton href="/admin/lizenzen/neu" variant="ghost" size="sm">
              Neue Lizenz
            </LinkButton>
          }
        >
          {club.licenses.length === 0 ? (
            <p className="text-muted text-sm">Keine Lizenz zugewiesen. Ohne Lizenz ist der Verein schreibgeschützt.</p>
          ) : (
            <ul className="space-y-2">
              {club.licenses.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3">
                  <Link href={`/admin/lizenzen/${l.id}`} className="hover:underline">
                    {l.name} <span className="text-muted font-mono text-xs">{l.key}</span>
                  </Link>
                  <Badge tone={isLicenseActive(l) ? "ok" : "danger"}>{isLicenseActive(l) ? "gültig" : "ungültig"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Vorstands-Zugänge">
          <ul className="space-y-3">
            {club.users.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3">
                <span>
                  {u.name}{" "}
                  <span className="text-muted text-sm">
                    · {ROLE_LABELS[u.role]} · {u.email}
                  </span>
                </span>
                {!u.passwordHash && (
                  <ActionButton action={resendAdminInvite} fields={{ userId: u.id }}>
                    Einladung erneut senden
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Module">
          <ModulesForm action={updateModules.bind(null, club.id)} modules={club.modules} />
        </Panel>
        <Panel title="Aktivität" className="lg:col-span-2">
          {activity.length === 0 ? (
            <p className="text-muted text-sm">Noch keine Aktivität.</p>
          ) : (
            <ul className="divide-line divide-y text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex justify-between gap-4 py-2">
                  <span>
                    {a.user?.name ?? "–"}: {a.action}
                    {a.detail ? ` – ${a.detail}` : ""}
                  </span>
                  <span className="text-muted shrink-0">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Verein löschen" className="lg:col-span-2">
          <p className="text-muted mb-4 text-sm">
            Löscht den Verein mit allen Mitgliedern, Buchungen, Terminen, Dokumenten und Zugängen. Das kann nicht rückgängig gemacht werden.
          </p>
          <form action={deleteClub} className="flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="id" value={club.id} />
            <input
              name="confirm"
              placeholder={`Zur Bestätigung „${club.name}“ eingeben`}
              aria-label="Vereinsname zur Bestätigung"
              className="border-line bg-surface h-10 flex-1 rounded-md border px-3"
            />
            <Button variant="danger">Endgültig löschen</Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
