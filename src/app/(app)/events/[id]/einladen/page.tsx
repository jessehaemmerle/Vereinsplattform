import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { formatDateTime } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { MessageForm } from "@/components/message-form";
import { RecipientGroups } from "@/components/recipient-groups";
import { inviteToEvent } from "../../actions";

export const metadata = { title: "Zum Termin einladen" };

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("mail:send", "KOMMUNIKATION");
  const { id } = await params;
  const [event, templates, counts] = await Promise.all([
    db.event.findFirst({ where: { id, clubId: user.clubId } }),
    db.emailTemplate.findMany({ where: { clubId: user.clubId }, orderBy: { name: "asc" } }),
    db.member.groupBy({ by: ["status"], where: { clubId: user.clubId }, _count: true }),
  ]);
  if (!event) notFound();
  const body = `Hallo {{vorname}},\n\nwir laden dich herzlich ein: {{termin}} am {{datum}}${event.location ? " in {{ort}}" : ""}.\n\n${event.description ?? ""}\n\nLiebe Grüße\n{{verein}}`;
  return (
    <>
      <PageHeader title={`Einladung: ${event.title}`} description={formatDateTime(event.startsAt)} />
      <MessageForm
        action={inviteToEvent.bind(null, event.id)}
        templates={templates}
        cancelHref="/events"
        defaults={{ subject: `Einladung: ${event.title}`, body }}
      >
        <RecipientGroups counts={Object.fromEntries(counts.map((c) => [c.status, c._count]))} />
        <p className="text-muted text-sm">Zusätzliche Platzhalter: {"{{termin}}, {{datum}}, {{ort}}"}</p>
      </MessageForm>
    </>
  );
}
