import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireClubUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { activeLicense } from "@/lib/license";
import { formatDate, formatDateTime, formatEur } from "@/lib/format";
import { InvoiceStatus } from "@/components/invoices/invoice-views";
import { clubUrl } from "@/lib/hosts";
import { Badge, Dl, PageHeader, Panel } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { CopyField } from "@/components/copy-field";
import { ClubForm, InviteForm, MfaPolicyForm, PasswordForm, ProfileForm } from "./forms";
import { BrandingForm } from "./branding-form";
import { changeRole, regenerateCalendarToken, resetUserMfa } from "./actions";
import { assetUrl } from "@/lib/branding";

export const metadata = { title: "Einstellungen" };

export default async function SettingsPage() {
  const user = await requireClubUser();
  if (user.role === "MITGLIED") redirect("/mein-bereich");
  const manage = can(user.role, "club:manage");
  const club = user.club;
  const [staff, license] = await Promise.all([
    manage
      ? db.user.findMany({
          where: { clubId: club.id, role: { not: "MITGLIED" } },
          orderBy: { name: "asc" },
          include: { _count: { select: { passkeys: true } } },
        })
      : [],
    activeLicense(club.id),
  ]);
  const platformInvoices = can(user.role, "finance:read")
    ? await db.invoice.findMany({ where: { issuerClubId: null, recipientClubId: club.id, status: { not: "DRAFT" } }, orderBy: { issueDate: "desc" }, take: 24 })
    : [];

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
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                      {s.totpEnabledAt || s._count.passkeys ? <Badge tone="ok">2FA aktiv</Badge> : <Badge>ohne 2FA</Badge>}
                      {s.id !== user.id && s.role !== "ADMIN" && (s.totpEnabledAt || s._count.passkeys > 0) && (
                        <ActionButton
                          action={resetUserMfa}
                          fields={{ id: s.id }}
                          variant="ghost"
                          confirm={`Zwei-Faktor-Anmeldung von ${s.name} zurücksetzen? Die Person wird abgemeldet und per E-Mail informiert.`}
                        >
                          2FA zurücksetzen
                        </ActionButton>
                      )}
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
            <h3 className="mb-3 font-medium">Zwei-Faktor-Anmeldung</h3>
            <div className="mb-8">
              <MfaPolicyForm policy={club.mfaPolicy} />
            </div>
            <h3 className="mb-3 font-medium">Neuen Zugang einrichten</h3>
            <InviteForm />
          </Panel>
        )}
        {manage && (
          <Panel title="Erscheinungsbild" className="lg:col-span-2">
            <BrandingForm
              branding={{
                name: club.name,
                primaryColor: club.primaryColor,
                accentColor: club.accentColor,
                fontKey: club.fontKey,
                loginTitle: club.loginTitle ?? "",
                loginText: club.loginText ?? "",
                emailSenderName: club.emailSenderName ?? "",
                emailFooter: club.emailFooter ?? "",
                images: {
                  logo: assetUrl(club, "logo"),
                  logoDark: assetUrl(club, "logo-dunkel"),
                  favicon: assetUrl(club, "favicon"),
                  loginImage: assetUrl(club, "login-bild"),
                },
              }}
            />
          </Panel>
        )}
        <Panel title="Rechnungen der Plattform">
          {platformInvoices.length === 0 ? (
            <p className="text-muted text-sm">Noch keine Rechnungen.</p>
          ) : (
            <ul className="divide-line divide-y text-sm">
              {platformInvoices.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <a href={`/api/rechnungen/${i.id}`} target="_blank" className="text-loden font-medium hover:underline">
                    {i.number}
                  </a>
                  <span className="text-muted">{formatDate(i.issueDate)}</span>
                  <span>{formatEur(i.grossCents / 100)}</span>
                  <InvoiceStatus invoice={i} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
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
          <CopyField value={clubUrl(club.slug, "/registrieren")} />
          {club.modules.includes("EVENTS") && (
            <>
              <p className="mt-5 mb-2 text-sm font-medium">Kalender-Abo</p>
              <CopyField value={clubUrl(club.slug, `/api/kalender/${club.calendarToken}`)} />
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
