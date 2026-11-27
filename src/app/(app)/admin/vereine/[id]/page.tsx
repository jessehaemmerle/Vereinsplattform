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
import { LogIn } from "lucide-react";
import { baseDomain, clubUrl } from "@/lib/hosts";
import { buildTheme } from "@/lib/color";
import { ModulesForm, SlugForm } from "../../forms";
import {
  changeSlug,
  createLicenseForPlan,
  createOneTimePassword,
  deleteClub,
  resendAdminInvite,
  resetClubUserMfa,
  startImpersonation,
  updateModules,
} from "../../actions";
import { visibleOneTimePassword } from "@/lib/initial-password";

export default async function ClubAdminPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const club = await db.club.findUnique({
    where: { id },
    include: {
      licenses: true,
      users: { where: { role: { not: "MITGLIED" } }, orderBy: { name: "asc" }, include: { _count: { select: { passkeys: true } } } },
      _count: { select: { members: true, transactions: true, events: true, documents: true } },
    },
  });
  if (!club) notFound();
  const plans = await db.licensePlan.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const activity = await db.activity.findMany({ where: { clubId: id }, orderBy: { createdAt: "desc" }, take: 20, include: { user: true } });

  return (
    <>
      <PageHeader
        title={club.name}
        description={
          <a href={clubUrl(club.slug)} target="_blank" rel="noreferrer" className="hover:text-loden hover:underline">
            {club.slug}.{baseDomain()}
          </a>
        }
        actions={
          <>
            <LinkButton href="/admin" variant="ghost">
              Zur Übersicht
            </LinkButton>
            <ActionButton
              action={startImpersonation}
              fields={{ clubId: club.id }}
              variant="primary"
              size="md"
              confirm={`Als Vereins-Admin im ${club.name} anmelden? Die Sitzung dauert eine Stunde und wird im Protokoll des Vereins vermerkt.`}
            >
              <LogIn className="size-4" /> Als Verein einloggen
            </ActionButton>
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Adresse">
          <SlugForm action={changeSlug.bind(null, club.id)} slug={club.slug} baseDomain={baseDomain()} />
          {club.previousSlug && club.slugChangedAt && (
            <p className="text-muted mt-4 text-sm">
              Die frühere Adresse {club.previousSlug}.{baseDomain()} leitet bis {formatDate(new Date(club.slugChangedAt.getTime() + 90 * 86_400_000))} weiter.
            </p>
          )}
        </Panel>
        <Panel title="Erscheinungsbild">
          <div className="flex items-center gap-4">
            <span
              className="size-10 rounded"
              style={{ background: buildTheme(club.primaryColor, club.accentColor).light["--loden"] }}
              aria-label="Hauptfarbe"
            />
            <span className="size-10 rounded" style={{ background: club.accentColor }} aria-label="Akzentfarbe" />
            <div className="text-sm">
              <p>
                {club.primaryColor} · {club.accentColor}
              </p>
              <p className="text-muted">
                Logo {club.logoPath ? "vorhanden" : "fehlt"} · Schrift {club.fontKey}
              </p>
            </div>
          </div>
          <p className="text-muted mt-4 text-sm">Der Verein gestaltet das selbst unter Einstellungen → Erscheinungsbild.</p>
        </Panel>
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
          {plans.length > 0 && (
            <form action={createLicenseForPlan} className="border-line mt-5 flex flex-wrap gap-2 border-t pt-4">
              <input type="hidden" name="clubId" value={club.id} />
              <select name="planId" aria-label="Paket" className="border-line bg-surface h-8 rounded-md border px-2 text-sm">
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="secondary">
                Neue Lizenz aus Paket
              </Button>
            </form>
          )}
        </Panel>
        <Panel title="Vorstands-Zugänge">
          <ul className="divide-line divide-y">
            {club.users.map((u) => {
              const otp = visibleOneTimePassword(u);
              return (
                <li key={u.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {u.name}{" "}
                      <span className="text-muted text-sm">
                        · {ROLE_LABELS[u.role]} · {u.email}
                      </span>
                      {u.mustChangePassword && !otp && (
                        <span className="ml-2">
                          <Badge tone="warn">
                            {u.oneTimePasswordExp && u.oneTimePasswordExp < new Date() ? "Einmal-Passwort abgelaufen" : "Passwortwechsel ausstehend"}
                          </Badge>
                        </span>
                      )}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {(u.totpEnabledAt || u._count.passkeys > 0) && (
                        <ActionButton
                          action={resetClubUserMfa}
                          fields={{ userId: u.id }}
                          variant="ghost"
                          confirm={`Zwei-Faktor-Anmeldung von ${u.name} zurücksetzen? Die Person wird abgemeldet und per E-Mail informiert.`}
                        >
                          2FA zurücksetzen
                        </ActionButton>
                      )}
                      {!u.passwordHash && (
                        <ActionButton action={resendAdminInvite} fields={{ userId: u.id }}>
                          Einladung erneut senden
                        </ActionButton>
                      )}
                      <ActionButton
                        action={createOneTimePassword}
                        fields={{ userId: u.id }}
                        variant="ghost"
                        confirm={
                          u.passwordHash && !u.mustChangePassword
                            ? `Einmal-Passwort für ${u.name} erstellen? Das bisherige Passwort gilt dann nicht mehr und die Person wird abgemeldet.`
                            : undefined
                        }
                      >
                        {otp ? "Neues Einmal-Passwort" : "Einmal-Passwort erstellen"}
                      </ActionButton>
                    </span>
                  </div>
                  {otp && (
                    <div className="border-brass/40 bg-brass/5 rounded-md border px-4 py-3 text-sm">
                      <p className="text-muted">Einmal-Passwort (gültig bis {formatDateTime(otp.expires)}, nur bis zur ersten Anmeldung sichtbar):</p>
                      <p className="my-1 font-mono text-lg tracking-wider select-all" data-testid="one-time-password">
                        {otp.password}
                      </p>
                      <p className="text-muted">
                        Anmeldung unter{" "}
                        <a href={clubUrl(club.slug, "/login")} className="text-loden underline" target="_blank" rel="noreferrer">
                          {clubUrl(club.slug, "/login")}
                        </a>{" "}
                        mit {u.email}. Danach wird ein eigenes Passwort verlangt.
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
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
