import { viennaYear } from "@/lib/format";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { formatDateTime } from "@/lib/format";
import { mailConfigured } from "@/lib/mail";
import { LinkButton } from "@/components/ui/button";
import { Notice, PageHeader, Panel } from "@/components/ui/misc";
import { Checkbox } from "@/components/ui/form";
import { MessageForm } from "@/components/message-form";
import { RecipientGroups } from "@/components/recipient-groups";
import { sendCircular } from "./actions";

export const metadata = { title: "Nachrichten" };

export default async function MessagesPage() {
  const user = await staff("mail:send", "KOMMUNIKATION");
  const [templates, log, counts] = await Promise.all([
    db.emailTemplate.findMany({ where: { clubId: user.clubId }, orderBy: { name: "asc" } }),
    db.emailLog.findMany({ where: { clubId: user.clubId }, orderBy: { sentAt: "desc" }, take: 15 }),
    db.member.groupBy({ by: ["status"], where: { clubId: user.clubId }, _count: true }),
  ]);
  return (
    <>
      <PageHeader title="Nachrichten" description="Rundschreiben an Mitglieder. Jede Person bekommt eine eigene E-Mail – Adressen bleiben unter euch." />
      {!mailConfigured() && (
        <div className="mb-6">
          <Notice tone="warn">Es ist kein SMTP-Server eingerichtet. E-Mails werden nur ins Server-Log geschrieben.</Notice>
        </div>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Panel title="Rundschreiben">
          <MessageForm action={sendCircular} templates={templates} cancelHref="/dashboard">
            <RecipientGroups counts={Object.fromEntries(counts.map((c) => [c.status, c._count]))} />
            <Checkbox
              name="onlyUnpaid"
              label={`Nur mit offenem Beitrag ${viennaYear()}`}
              hint="Für Zahlungserinnerungen. Zusätzliche Platzhalter: {{beitrag}}, {{iban}}"
            />
          </MessageForm>
        </Panel>
        <div className="space-y-6">
          <Panel
            title="Vorlagen"
            actions={
              <LinkButton href="/nachrichten/vorlagen/neu" variant="ghost" size="sm">
                <Plus className="size-4" /> Neu
              </LinkButton>
            }
          >
            {templates.length === 0 ? (
              <p className="text-muted text-sm">Speichere wiederkehrende Texte wie Zahlungserinnerung oder Einladung zur Generalversammlung.</p>
            ) : (
              <ul className="space-y-2">
                {templates.map((t) => (
                  <li key={t.id}>
                    <Link href={`/nachrichten/vorlagen/${t.id}`} className="hover:text-loden hover:underline">
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Zuletzt gesendet">
            {log.length === 0 ? (
              <p className="text-muted text-sm">Noch nichts gesendet.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {log.map((l) => (
                  <li key={l.id}>
                    <p className="font-medium">{l.subject}</p>
                    <p className="text-muted">
                      {formatDateTime(l.sentAt)} · {l.recipients} Empfänger{l.failed ? `, ${l.failed} fehlgeschlagen` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
