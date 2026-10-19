import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { PageHeader } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { NoteForm } from "../note-form";
import { deleteNote, saveNote } from "../actions";

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("notes:write", "NOTIZEN");
  const { id } = await params;
  if (id === "neu") {
    return (
      <>
        <PageHeader title="Notiz schreiben" />
        <NoteForm action={saveNote.bind(null, null)} />
      </>
    );
  }
  const note = await db.note.findFirst({ where: { id, clubId: user.clubId } });
  if (!note) notFound();
  return (
    <>
      <PageHeader
        title="Notiz bearbeiten"
        actions={
          <ActionButton action={deleteNote} fields={{ id: note.id }} variant="danger" size="md" confirm="Notiz löschen?">
            Löschen
          </ActionButton>
        }
      />
      <NoteForm action={saveNote.bind(null, note.id)} note={note} />
    </>
  );
}
