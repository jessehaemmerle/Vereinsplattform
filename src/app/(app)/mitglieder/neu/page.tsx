import { staff } from "@/lib/guard";
import { PageHeader } from "@/components/ui/misc";
import { MemberForm } from "../member-form";
import { saveMember } from "../actions";

export const metadata = { title: "Mitglied anlegen" };

export default async function NewMemberPage() {
  await staff("members:write", "MITGLIEDER");
  return (
    <>
      <PageHeader title="Mitglied anlegen" />
      <MemberForm action={saveMember.bind(null, null)} cancelHref="/mitglieder" />
    </>
  );
}
