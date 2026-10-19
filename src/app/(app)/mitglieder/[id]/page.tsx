import { viennaYear } from "@/lib/format";
import { notFound } from "next/navigation";
import { Mail, Pencil, Send } from "lucide-react";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { ageOn, formatDate, formatDateTime, formatEur } from "@/lib/format";
import { LinkButton } from "@/components/ui/button";
import { Badge, Dl, PageHeader, Panel } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { STATUS_LABELS, STATUS_TONES } from "../schema";
import { deleteMember, inviteMember, toggleFee } from "../actions";

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("members:read", "MITGLIEDER");
  const { id } = await params;
  const member = await db.member.findFirst({
    where: { id, clubId: user.clubId },
    include: { user: true, transactions: { orderBy: { date: "desc" }, take: 50 } },
  });
  if (!member) notFound();
  const year = viennaYear();
  const paid = member.feePaidYear === year;
  const canWrite = can(user.role, "members:write");
  const canMail = can(user.role, "mail:send") && user.club.modules.includes("KOMMUNIKATION");
  const address = [member.street, [member.zip, member.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <>
      <PageHeader
        title={`${member.firstName} ${member.lastName}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONES[member.status]}>{STATUS_LABELS[member.status]}</Badge>
            {member.function && <span>{member.function}</span>}
          </span>
        }
        actions={
          <>
            {canMail && (
              <LinkButton href={`/mitglieder/${member.id}/nachricht`} variant="secondary">
                <Mail className="size-4" /> Nachricht
              </LinkButton>
            )}
            {canWrite && (
              <LinkButton href={`/mitglieder/${member.id}/bearbeiten`}>
                <Pencil className="size-4" /> Bearbeiten
              </LinkButton>
            )}
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-6">
          <Panel title="Kontakt und Person">
            <Dl
              items={[
                [
                  "E-Mail",
                  <a key="m" href={`mailto:${member.email}`} className="text-loden hover:underline">
                    {member.email}
                  </a>,
                ],
                ["Telefon", member.phone],
                ["Adresse", address || null],
                ["Geburtstag", member.birthday ? `${formatDate(member.birthday)} (${ageOn(member.birthday)} Jahre)` : null],
                ["Eingetreten", formatDate(member.joinedAt)],
                ...(member.leftAt ? ([["Ausgetreten", formatDate(member.leftAt)]] as [string, string][]) : []),
              ]}
            />
            {member.notes && <p className="bg-paper text-muted mt-5 rounded-md p-3 text-sm whitespace-pre-wrap">{member.notes}</p>}
          </Panel>
          <Panel title="Buchungen">
            {member.transactions.length === 0 ? (
              <p className="text-muted text-sm">Noch keine Buchungen mit diesem Mitglied verknüpft.</p>
            ) : (
              <ul className="divide-line divide-y text-sm">
                {member.transactions.map((t) => (
                  <li key={t.id} className="flex justify-between gap-4 py-2">
                    <span>
                      {formatDate(t.date)} · {t.description ?? t.category}
                    </span>
                    <span className={t.type === "EINNAHME" ? "text-ok" : "text-danger"}>
                      {t.type === "EINNAHME" ? "+" : "−"}
                      {formatEur(t.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title={`Beitrag ${year}`}>
            {Number(member.fee) === 0 ? (
              <p className="text-muted">Beitragsfrei</p>
            ) : (
              <>
                <p className="text-2xl font-semibold">{formatEur(member.fee)}</p>
                <p className="mt-1 mb-4">
                  <Badge tone={paid ? "ok" : "warn"}>{paid ? "bezahlt" : "offen"}</Badge>
                </p>
                {can(user.role, "fees:write") && (
                  <ActionButton
                    action={toggleFee}
                    fields={{ id: member.id }}
                    variant={paid ? "ghost" : "primary"}
                    size="md"
                    confirm={paid ? "Zahlung zurücknehmen? Die automatische Buchung wird gelöscht." : undefined}
                  >
                    {paid ? "Zahlung zurücknehmen" : "Als bezahlt buchen"}
                  </ActionButton>
                )}
              </>
            )}
          </Panel>
          <Panel title="Mitgliederbereich">
            {member.user?.passwordHash ? (
              <p className="text-sm">Zugang aktiv{member.user.lastLoginAt ? `, zuletzt angemeldet am ${formatDateTime(member.user.lastLoginAt)}` : ""}.</p>
            ) : (
              <p className="text-muted mb-4 text-sm">
                Noch kein Zugang. Mit einer Einladung legt das Mitglied selbst ein Passwort fest und sieht dann seine Daten, Termine und freigegebene Dokumente.
              </p>
            )}
            {canWrite && !member.user?.passwordHash && member.status !== "AUSGETRETEN" && (
              <ActionButton action={inviteMember} fields={{ id: member.id }} size="md">
                <Send className="size-4" /> Einladung senden
              </ActionButton>
            )}
          </Panel>
          {canWrite && (
            <Panel title="Löschen">
              <p className="text-muted mb-4 text-sm">
                Für ausgetretene Mitglieder reicht meist der Status „Ausgetreten“. Löschen entfernt alle Daten endgültig.
              </p>
              <ActionButton
                action={deleteMember}
                fields={{ id: member.id }}
                variant="danger"
                size="md"
                confirm={`${member.firstName} ${member.lastName} endgültig löschen?`}
              >
                Mitglied löschen
              </ActionButton>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}
