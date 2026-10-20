import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { PageHeader } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { TemplateForm } from "./template-form";
import { deleteTemplate, saveTemplate } from "../../actions";

export const metadata = { title: "Vorlage" };

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("mail:send", "KOMMUNIKATION");
  const { id } = await params;
  if (id === "neu") {
    return (
      <>
        <PageHeader title="Neue Vorlage" />
        <TemplateForm action={saveTemplate.bind(null, null)} />
      </>
    );
  }
  const template = await db.emailTemplate.findFirst({ where: { id, clubId: user.clubId } });
  if (!template) notFound();
  return (
    <>
      <PageHeader
        title="Vorlage bearbeiten"
        actions={
          <ActionButton action={deleteTemplate} fields={{ id }} variant="danger" size="md" confirm="Vorlage löschen?">
            Löschen
          </ActionButton>
        }
      />
      <TemplateForm action={saveTemplate.bind(null, id)} template={template} />
    </>
  );
}
