"use client";

import { ActionForm, FormGrid, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import type { FormState } from "@/lib/form";

export function ContactForm({
  action,
  contact,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  contact?: { name: string; address: string | null; email: string | null; vatId: string | null; notes: string | null };
}) {
  return (
    <ActionForm action={action} className="max-w-2xl">
      <FormGrid>
        <Input label="Name / Firma" name="name" required defaultValue={contact?.name} />
        <Input label="E-Mail" name="email" type="email" defaultValue={contact?.email ?? ""} />
      </FormGrid>
      <Textarea label="Anschrift" name="address" rows={3} defaultValue={contact?.address ?? ""} placeholder={"Straße 1\n1234 Ort"} />
      <Input label="UID-Nummer" name="vatId" defaultValue={contact?.vatId ?? ""} />
      <Textarea label="Notiz" name="notes" rows={2} defaultValue={contact?.notes ?? ""} />
      <div className="flex gap-3">
        <SubmitButton>Kontakt speichern</SubmitButton>
        <LinkButton href="/rechnungen/kontakte" variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}
