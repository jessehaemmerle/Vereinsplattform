import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { PageHeader } from "@/components/ui/misc";
import { MessageForm } from "@/components/message-form";
import { messageMember } from "../../actions";

export const metadata = { title: "Nachricht senden" };

export default async function MessagePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("mail:send", "KOMMUNIKATION");
  const { id } = await params;
  const [member, templates] = await Promise.all([
    db.member.findFirst({ where: { id, clubId: user.clubId } }),
    db.emailTemplate.findMany({ where: { clubId: user.clubId }, orderBy: { name: "asc" } }),
  ]);
  if (!member) notFound();
  return (
    <>
      <PageHeader title={`Nachricht an ${member.firstName} ${member.lastName}`} description={member.email} />
      <MessageForm action={messageMember.bind(null, member.id)} templates={templates} cancelHref={`/mitglieder/${member.id}`} />
    </>
  );
}
