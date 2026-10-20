"use client";

import { ActionForm, Checkbox, FormGrid, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import type { FormState } from "@/lib/form";

type EventData = { title: string; description: string | null; location: string | null; startsAt: string; endsAt: string; cost: string; public: boolean };

export function EventForm({ action, event }: { action: (s: FormState, f: FormData) => Promise<FormState>; event?: EventData }) {
  return (
    <ActionForm action={action} className="max-w-2xl">
      <Input label="Titel" name="title" defaultValue={event?.title} required placeholder="z. B. Jahreshauptversammlung" />
      <FormGrid>
        <Input label="Beginn" name="startsAt" type="datetime-local" defaultValue={event?.startsAt} required />
        <Input label="Ende (optional)" name="endsAt" type="datetime-local" defaultValue={event?.endsAt} />
      </FormGrid>
      <Input label="Ort" name="location" defaultValue={event?.location ?? ""} />
      <Textarea label="Beschreibung" name="description" defaultValue={event?.description ?? ""} rows={5} />
      <Input
        label="Kosten für den Verein (EUR, optional)"
        name="cost"
        inputMode="decimal"
        defaultValue={event?.cost}
        hint="Wird automatisch als Ausgabe „Eventkosten“ in den Finanzen gebucht und bei Änderungen angepasst."
      />
      <Checkbox
        label="Für Mitglieder sichtbar"
        name="public"
        defaultChecked={event?.public ?? true}
        hint="Erscheint im Mitgliederbereich und im Kalender-Abo."
      />
      <div className="flex gap-3">
        <SubmitButton>{event ? "Termin speichern" : "Termin anlegen"}</SubmitButton>
        <LinkButton href="/events" variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}
