import { FileText } from "lucide-react";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatBytes, formatDate } from "@/lib/format";
import { Badge, EmptyState, PageHeader, Panel, Table, Td } from "@/components/ui/misc";
import { ActionForm, Checkbox, Input, SubmitButton } from "@/components/ui/form";
import { ActionButton } from "@/components/ui/confirm-form";
import { deleteDocument, toggleDocumentVisibility, uploadDocument } from "./actions";

export const metadata = { title: "Dokumente" };

export default async function DocumentsPage() {
  const user = await staff("docs:read", "DOKUMENTE");
  const docs = await db.document.findMany({ where: { clubId: user.clubId }, orderBy: { createdAt: "desc" }, include: { uploadedBy: true } });
  const canWrite = can(user.role, "docs:write");
  return (
    <>
      <PageHeader title="Dokumente" description="Statuten, Protokolle, Formulare. Freigegebene Dokumente sehen auch die Mitglieder in ihrem Bereich." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          {docs.length === 0 ? (
            <EmptyState title="Noch keine Dokumente">Lade zum Beispiel eure Statuten hoch und gib sie für Mitglieder frei.</EmptyState>
          ) : (
            <Table head={["Datei", "Hochgeladen", "Sichtbarkeit", ""]}>
              {docs.map((d) => (
                <tr key={d.id}>
                  <Td>
                    <a href={`/api/dokumente/${d.id}`} className="hover:text-loden flex items-start gap-2 font-medium hover:underline">
                      <FileText className="text-loden mt-0.5 size-4 shrink-0" />
                      <span className="break-all">{d.originalName}</span>
                    </a>
                    {d.description && <p className="text-muted mt-0.5 ml-6 text-sm">{d.description}</p>}
                  </Td>
                  <Td className="text-muted whitespace-nowrap">
                    {formatDate(d.createdAt)}
                    <span className="block text-xs">
                      {formatBytes(d.size)}
                      {d.uploadedBy ? ` · ${d.uploadedBy.name}` : ""}
                    </span>
                  </Td>
                  <Td>
                    {canWrite ? (
                      <ActionButton action={toggleDocumentVisibility} fields={{ id: d.id }} variant="ghost">
                        {d.visibleToMembers ? <Badge tone="ok">für Mitglieder</Badge> : <Badge>nur Vorstand</Badge>}
                      </ActionButton>
                    ) : d.visibleToMembers ? (
                      <Badge tone="ok">für Mitglieder</Badge>
                    ) : (
                      <Badge>nur Vorstand</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    {canWrite && (
                      <ActionButton action={deleteDocument} fields={{ id: d.id }} variant="ghost" confirm={`„${d.originalName}“ löschen?`}>
                        Löschen
                      </ActionButton>
                    )}
                  </Td>
                </tr>
              ))}
            </Table>
          )}
        </div>
        {canWrite && (
          <Panel title="Hochladen" className="self-start">
            <ActionForm action={uploadDocument} resetOnOk>
              <div className="space-y-1.5">
                <label htmlFor="file" className="block text-sm font-medium">
                  Datei (max. 20 MB)
                </label>
                <input
                  id="file"
                  type="file"
                  name="file"
                  required
                  className="file:bg-loden-soft file:text-loden block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:px-3 file:py-2"
                />
              </div>
              <Input label="Beschreibung (optional)" name="description" />
              <Checkbox label="Für Mitglieder freigeben" name="visibleToMembers" />
              <SubmitButton pendingText="Wird hochgeladen …">Hochladen</SubmitButton>
            </ActionForm>
          </Panel>
        )}
      </div>
    </>
  );
}
