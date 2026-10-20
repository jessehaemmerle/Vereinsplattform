"use client";

import { ActionForm, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import type { FormState } from "@/lib/form";

export function TemplateForm({
  action,
  template,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  template?: { name: string; subject: string; body: string };
}) {
  return (
    <ActionForm action={action} className="max-w-3xl">
      <Input label="Name der Vorlage" name="name" defaultValue={template?.name} required placeholder="z. B. Zahlungserinnerung" />
      <Input label="Betreff" name="subject" defaultValue={template?.subject} required />
      <Textarea
        label="Text"
        name="body"
        defaultValue={template?.body}
        rows={12}
        required
        hint="Platzhalter: {{vorname}}, {{nachname}}, {{verein}}, {{beitrag}}, {{iban}}"
      />
      <div className="flex gap-3">
        <SubmitButton>Vorlage speichern</SubmitButton>
        <LinkButton href="/nachrichten" variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}
