import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireClubUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { activeLicense } from "@/lib/license";
import { formatDate, formatDateTime } from "@/lib/format";
import { appUrl } from "@/lib/tokens";
import { Badge, Dl, PageHeader, Panel } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { CopyField } from "@/components/copy-field";
import { ClubForm, InviteForm, LogoForm, PasswordForm, ProfileForm } from "./forms";
import { changeRole, regenerateCalendarToken, removeLogo } from "./actions";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireClubUser();
  if (user.role === "MITGLIED") redirect("/mein-bereich");
  const manage = can(user.role, "club:manage");
  const club = user.club;
  const [staff, license] = await Promise.all([
    manage ? db.user.findMany({ where: { clubId: club.id, role: { not: "MITGLIED" } }, orderBy: { name: "asc" } }) : [],
    activeLicense(club.id),
  ]);

  return (
    <>
      <PageHeader title="Einstellungen" />
      <div className="grid gap-6 lg:grid-cols-2">
        {manage && (
          <Panel title="Verein" className="lg:col-span-2">
            <ClubForm club={{ ...club, openingBalance: club.openingBalance.toFixed(2).replace(".", ",") }} />
          </Panel>
        )}
        {manage && (
          <Panel title="Vorstand und Zugänge" className="lg:col-span-2">
            <ul className="divide-line mb-6 divide-y">
              {staff.map((s) => (
                <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">
                      {s.name} {s.id === user.id && <span className="text-muted">(du)</span>}
                    </p>
                    <p className="text-muted text-sm">
                      {s.email} · {s.passwordHash ? (s.lastLoginAt ? `zuletzt ${formatDateTime(s.lastLoginAt)}` : "noch nie angemeldet") : "Einladung offen"}
                    </p>
                  </div>
                  {s.id === user.id ? (
                    <Badge tone="loden">{ROLE_LABELS[s.role]}</Badge>
                  ) : (
                    <form action={changeRole} className="flex gap-2">
                      <input type="hidden" name="id" value={s.id} />
                      <select
                        name="role"
                        defaultValue={s.role}
                        aria-label={`Rolle von ${s.name}`}
                        className="border-line bg-surface h-8 rounded-md border px-2 text-sm"
                      >
                        {(["ADMIN", "KASSIER", "SCHRIFTFUEHRER", "VORSTAND"] as const).map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                        <option value="MITGLIED">Zugang entziehen</option>
                      </select>
                      <button className="border-line hover:border-loden h-8 rounded-md border px-3 text-sm">Ändern</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            <h3 className="mb-3 font-medium">Neuen Zugang einrichten</h3>
            <InviteForm />
          </Panel>
        )}
        {manage && (
          <Panel title="Logo">
            {club.logoPath && (
              <div className="mb-4 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/logo/${club.id}`} alt="Aktuelles Logo" className="border-line size-16 rounded border bg-white object-contain p-1" />
                <ActionButton action={removeLogo} variant="ghost" confirm="Logo entfernen?">
                  Entfernen
                </ActionButton>
              </div>
            )}
            <LogoForm />
          </Panel>
        )}
        <Panel title="Lizenz und Links">
          <Dl
            items={[
              [
                "Lizenz",
                license ? (
                  `${license.name}${license.status === "TRIAL" ? " (Test)" : ""}`
                ) : (
                  <Badge key="l" tone="danger">
                    keine gültige Lizenz
                  </Badge>
                ),
              ],
              ["Gültig bis", license ? (license.validUntil ? formatDate(license.validUntil) : "unbegrenzt") : "–"],
              ["Limits", license ? `${license.maxMembers ?? "∞"} Mitglieder, ${license.maxUsers ?? "∞"} Zugänge` : "–"],
            ]}
          />
          <p className="mt-5 mb-2 text-sm font-medium">Link für Mitglieder zur Zugangsanforderung</p>
          <CopyField value={appUrl(`/registrieren?verein=${club.slug}`)} />
          {club.modules.includes("EVENTS") && (
            <>
              <p className="mt-5 mb-2 text-sm font-medium">Kalender-Abo</p>
              <CopyField value={appUrl(`/api/kalender/${club.calendarToken}`)} />
              {manage && (
                <div className="mt-2">
                  <ActionButton action={regenerateCalendarToken} variant="ghost" confirm="Neuen Link erstellen? Bestehende Abos funktionieren dann nicht mehr.">
                    Neuen Kalender-Link erstellen
                  </ActionButton>
                </div>
              )}
            </>
          )}
        </Panel>
        <Panel title="Mein Profil">
          <ProfileForm name={user.name} emailNotifications={user.emailNotifications} />
        </Panel>
        <Panel title="Passwort ändern">
          <PasswordForm />
        </Panel>
      </div>
    </>
  );
}
