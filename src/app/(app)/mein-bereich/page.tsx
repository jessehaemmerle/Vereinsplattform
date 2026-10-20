import { viennaYear } from "@/lib/format";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireClubUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatEur } from "@/lib/format";
import { appUrl } from "@/lib/tokens";
import { Badge, Dl, PageHeader, Panel } from "@/components/ui/misc";
import { CopyField } from "@/components/copy-field";
import { STATUS_LABELS } from "@/app/(app)/mitglieder/schema";
import { PasswordForm } from "@/app/(app)/einstellungen/forms";
import { ContactForm } from "./contact-form";

export const metadata = { title: "Mein Bereich" };

export default async function MemberAreaPage() {
  const user = await requireClubUser();
  const member = user.member;
  if (!member) redirect("/dashboard");
  const club = user.club;
  const year = viennaYear();
  const paid = member.feePaidYear === year;
  const [events, docs] = await Promise.all([
    club.modules.includes("EVENTS")
      ? db.event.findMany({ where: { clubId: club.id, public: true, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 10 })
      : [],
    club.modules.includes("DOKUMENTE") ? db.document.findMany({ where: { clubId: club.id, visibleToMembers: true }, orderBy: { createdAt: "desc" } }) : [],
  ]);

  return (
    <>
      <PageHeader title={`Hallo ${member.firstName}`} description={`Dein Bereich beim ${club.name}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Mitgliedsbeitrag ${year}`}>
          {Number(member.fee) === 0 ? (
            <p>Du bist beitragsfrei.</p>
          ) : paid ? (
            <p className="flex items-center gap-3">
              <span className="text-2xl font-semibold">{formatEur(member.fee)}</span> <Badge tone="ok">bezahlt – danke!</Badge>
            </p>
          ) : (
            <>
              <p className="flex items-center gap-3">
                <span className="text-2xl font-semibold">{formatEur(member.fee)}</span> <Badge tone="warn">offen</Badge>
              </p>
              {club.iban && (
                <div className="mt-4 space-y-1 text-sm">
                  <p className="text-muted">Bitte überweise an</p>
                  <p className="font-medium">{club.name}</p>
                  <p className="font-mono">{club.iban.replace(/(.{4})/g, "$1 ").trim()}</p>
                  {club.bankName && <p className="text-muted">{club.bankName}</p>}
                  <p className="text-muted">
                    Verwendungszweck: Beitrag {year} {member.firstName} {member.lastName}
                  </p>
                </div>
              )}
            </>
          )}
        </Panel>
        <Panel title="Meine Mitgliedschaft">
          <Dl
            items={[
              ["Status", STATUS_LABELS[member.status]],
              ["Funktion", member.function],
              ["Mitglied seit", formatDate(member.joinedAt)],
              ["E-Mail", member.email],
            ]}
          />
          <p className="text-muted mt-4 text-sm">
            Für Änderungen an Name, E-Mail oder Status wende dich an den Vorstand{club.email ? ` (${club.email})` : ""}.
          </p>
        </Panel>
        {club.modules.includes("EVENTS") && (
          <Panel title="Nächste Termine">
            {events.length === 0 ? (
              <p className="text-muted text-sm">Gerade ist nichts geplant.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((e) => (
                  <li key={e.id}>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-muted text-sm">
                      {formatDateTime(e.startsAt)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                    {e.description && <p className="mt-1 text-sm">{e.description}</p>}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-5 mb-2 text-sm font-medium">In deinen Kalender übernehmen</p>
            <CopyField value={appUrl(`/api/kalender/${club.calendarToken}`)} />
          </Panel>
        )}
        {club.modules.includes("DOKUMENTE") && (
          <Panel title="Dokumente">
            {docs.length === 0 ? (
              <p className="text-muted text-sm">Noch keine Dokumente freigegeben.</p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id}>
                    <a href={`/api/dokumente/${d.id}`} className="hover:text-loden flex items-start gap-2 hover:underline">
                      <FileText className="text-loden mt-0.5 size-4 shrink-0" />
                      <span>
                        {d.originalName}
                        {d.description && <span className="text-muted block text-sm">{d.description}</span>}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
        <Panel title="Meine Kontaktdaten">
          <ContactForm member={member} />
        </Panel>
        <Panel title="Passwort ändern">
          <PasswordForm />
        </Panel>
      </div>
    </>
  );
}
