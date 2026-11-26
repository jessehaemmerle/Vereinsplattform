import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatDate, formatDateTime, toDateInput } from "@/lib/format";
import { isLicenseActive } from "@/lib/license";
import { Badge, Dl, PageHeader, Panel } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { LicenseForm } from "../../forms";
import { deleteLicense, extendLicense, saveLicense } from "../../actions";

export const metadata = { title: "Lizenz" };

export default async function LicensePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const [clubs, plans] = await Promise.all([
    db.club.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.licensePlan.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, maxUsers: true, maxMembers: true } }),
  ]);
  if (id === "neu") {
    return (
      <>
        <PageHeader title="Lizenz erstellen" description="Der Lizenzschlüssel wird automatisch erzeugt." />
        <LicenseForm action={saveLicense.bind(null, null)} clubs={clubs} plans={plans} />
      </>
    );
  }
  const l = await db.license.findUnique({ where: { id }, include: { plan: true, club: true, events: { orderBy: { createdAt: "desc" }, take: 50 } } });
  if (!l) notFound();
  const userIds = [...new Set(l.events.map((e) => e.userId).filter(Boolean))] as string[];
  const users = new Map((await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));
  const months = l.plan?.durationMonths ?? 12;

  return (
    <>
      <PageHeader
        title={l.name}
        description={<span className="font-mono">{l.key}</span>}
        actions={
          <ActionButton
            action={deleteLicense}
            fields={{ id: l.id }}
            variant="danger"
            size="md"
            confirm="Lizenz löschen? Der zugewiesene Verein wird dadurch eventuell schreibgeschützt."
          >
            Löschen
          </ActionButton>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <LicenseForm
          action={saveLicense.bind(null, l.id)}
          clubs={clubs}
          plans={plans}
          license={{
            name: l.name,
            status: l.status,
            maxUsers: l.maxUsers?.toString() ?? "",
            maxMembers: l.maxMembers?.toString() ?? "",
            validFrom: toDateInput(l.validFrom),
            validUntil: toDateInput(l.validUntil),
            notes: l.notes ?? "",
            clubId: l.clubId ?? "",
            planId: l.planId ?? "",
          }}
        />
        <div className="space-y-6">
          <Panel title="Laufzeit">
            <Dl
              items={[
                [
                  "Status",
                  <Badge key="s" tone={isLicenseActive(l) ? "ok" : "danger"}>
                    {isLicenseActive(l) ? "gültig" : "ungültig"}
                  </Badge>,
                ],
                ["Gültig bis", l.validUntil ? formatDate(l.validUntil) : "unbegrenzt"],
                [
                  "Verein",
                  l.club ? (
                    <Link key="c" href={`/admin/vereine/${l.club.id}`} className="hover:underline">
                      {l.club.name}
                    </Link>
                  ) : (
                    "–"
                  ),
                ],
                [
                  "Erinnert",
                  l.remindersSent.length
                    ? l.remindersSent
                        .sort((a, b) => b - a)
                        .map((d) => `${d} Tage`)
                        .join(", ") + " vorher"
                    : "noch nicht",
                ],
              ]}
            />
            <div className="mt-5 flex flex-wrap gap-2">
              <ActionButton action={extendLicense} fields={{ id: l.id, months: String(months) }} variant="primary" size="md">
                Um {months} Monate verlängern
              </ActionButton>
              {months !== 1 && (
                <ActionButton action={extendLicense} fields={{ id: l.id, months: "1" }} size="md">
                  + 1 Monat
                </ActionButton>
              )}
            </div>
            <p className="text-muted mt-3 text-xs">Verlängert ab dem bisherigen Ende, bei abgelaufenen Lizenzen ab heute.</p>
          </Panel>
          <Panel title="Verlauf">
            {l.events.length === 0 ? (
              <p className="text-muted text-sm">Noch keine Einträge.</p>
            ) : (
              <ol className="space-y-3 text-sm">
                {l.events.map((e) => (
                  <li key={e.id}>
                    <p>
                      <strong className="font-medium">{e.action}</strong>
                      {e.detail && <span className="text-muted"> – {e.detail}</span>}
                    </p>
                    <p className="text-muted text-xs">
                      {formatDateTime(e.createdAt)}
                      {e.userId ? ` · ${users.get(e.userId) ?? "gelöschter Benutzer"}` : " · automatisch"}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
