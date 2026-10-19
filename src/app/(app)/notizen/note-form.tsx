"use client";

import { ActionForm, Checkbox, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import type { FormState } from "@/lib/form";

export function NoteForm({
  action,
  note,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  note?: { title: string; content: string; pinned: boolean };
}) {
  return (
    <ActionForm action={action} className="max-w-3xl">
      <Input label="Titel" name="title" defaultValue={note?.title} required />
      <Textarea label="Inhalt" name="content" defaultValue={note?.content} rows={14} required />
      <Checkbox label="Oben anheften" name="pinned" defaultChecked={note?.pinned} />
      <div className="flex gap-3">
        <SubmitButton>Notiz speichern</SubmitButton>
        <LinkButton href="/notizen" variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}
