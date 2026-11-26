import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Table, Td } from "@/components/ui/misc";

export const metadata = { title: "Adressbuch" };

export default async function ContactsPage() {
  const user = await staff("invoices:write", "FINANZEN");
  const contacts = await db.contact.findMany({ where: { clubId: user.clubId }, orderBy: { name: "asc" }, include: { _count: { select: { invoices: true } } } });
  return (
    <>
      <PageHeader
        title="Adressbuch"
        description="Empfänger außerhalb des Vereins: Sponsoren, Gemeinden, Firmen, andere Vereine. Mitglieder stehen beim Rechnungschreiben automatisch zur Auswahl."
        actions={
          <LinkButton href="/rechnungen/kontakte/neu">
            <Plus className="size-4" /> Kontakt anlegen
          </LinkButton>
        }
      />
      {contacts.length === 0 ? (
        <EmptyState title="Noch keine Kontakte" />
      ) : (
        <Table head={["Name", "Anschrift", "E-Mail", "Rechnungen"]}>
          {contacts.map((c) => (
            <tr key={c.id}>
              <Td>
                <Link href={`/rechnungen/kontakte/${c.id}`} className="hover:text-loden font-medium hover:underline">
                  {c.name}
                </Link>
              </Td>
              <Td className="text-muted whitespace-pre-line">{c.address ?? "–"}</Td>
              <Td className="text-muted">{c.email ?? "–"}</Td>
              <Td>{c._count.invoices}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
