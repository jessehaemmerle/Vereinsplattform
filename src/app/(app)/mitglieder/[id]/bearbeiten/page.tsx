import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { PageHeader } from "@/components/ui/misc";
import { MemberForm } from "../../member-form";
import { saveMember } from "../../actions";

export const metadata = { title: "Mitglied bearbeiten" };

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("members:write", "MITGLIEDER");
  const { id } = await params;
  const member = await db.member.findFirst({ where: { id, clubId: user.clubId } });
  if (!member) notFound();
  return (
    <>
      <PageHeader title={`${member.firstName} ${member.lastName} bearbeiten`} />
      <MemberForm action={saveMember.bind(null, member.id)} member={{ ...member, fee: member.fee.toString() }} cancelHref={`/mitglieder/${member.id}`} />
    </>
  );
}
