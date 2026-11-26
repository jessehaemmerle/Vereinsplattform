import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { PageHeader } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { ContactForm } from "../contact-form";
import { deleteContact, saveContact } from "../../actions";

export const metadata = { title: "Kontakt" };

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("invoices:write", "FINANZEN");
  const { id } = await params;
  if (id === "neu") {
    return (
      <>
        <PageHeader title="Kontakt anlegen" />
        <ContactForm action={saveContact.bind(null, null)} />
      </>
    );
  }
  const contact = await db.contact.findFirst({ where: { id, clubId: user.clubId } });
  if (!contact) notFound();
  return (
    <>
      <PageHeader
        title={contact.name}
        actions={
          <ActionButton
            action={deleteContact}
            fields={{ id }}
            variant="danger"
            size="md"
            confirm="Kontakt löschen? Ausgestellte Rechnungen behalten die Empfängerdaten."
          >
            Löschen
          </ActionButton>
        }
      />
      <ContactForm action={saveContact.bind(null, id)} contact={contact} />
    </>
  );
}
