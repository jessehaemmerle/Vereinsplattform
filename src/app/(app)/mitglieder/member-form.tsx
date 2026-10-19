"use client";

import type { Member } from "@prisma/client";
import { ActionForm, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import { toDateInput } from "@/lib/format";
import type { FormState } from "@/lib/form";
import { STATUS_LABELS } from "./schema";

type MemberData = Omit<Member, "fee"> & { fee: string };

export function MemberForm({
  action,
  member,
  cancelHref,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  member?: MemberData;
  cancelHref: string;
}) {
  return (
    <ActionForm action={action} className="max-w-3xl">
      <fieldset className="space-y-5">
        <legend className="mb-3 font-semibold">Person</legend>
        <FormGrid>
          <Input label="Vorname" name="firstName" defaultValue={member?.firstName} required autoComplete="off" />
          <Input label="Nachname" name="lastName" defaultValue={member?.lastName} required autoComplete="off" />
          <Input label="E-Mail" name="email" type="email" defaultValue={member?.email} required autoComplete="off" />
          <Input label="Telefon" name="phone" defaultValue={member?.phone ?? ""} />
          <Input label="Geburtstag" name="birthday" type="date" defaultValue={toDateInput(member?.birthday)} />
        </FormGrid>
      </fieldset>
      <fieldset className="border-line space-y-5 border-t pt-5">
        <legend className="mb-3 font-semibold">Adresse</legend>
        <Input label="Straße und Hausnummer" name="street" defaultValue={member?.street ?? ""} />
        <div className="grid grid-cols-[8rem_1fr] gap-5">
          <Input label="PLZ" name="zip" defaultValue={member?.zip ?? ""} />
          <Input label="Ort" name="city" defaultValue={member?.city ?? ""} />
        </div>
      </fieldset>
      <fieldset className="border-line space-y-5 border-t pt-5">
        <legend className="mb-3 font-semibold">Mitgliedschaft</legend>
        <FormGrid>
          <Select
            label="Status"
            name="status"
            defaultValue={member?.status ?? "AKTIV"}
            options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          />
          <Input label="Funktion" name="function" defaultValue={member?.function ?? ""} placeholder="z. B. Obfrau, Kassier, Trainer" />
          <Input label="Eintrittsdatum" name="joinedAt" type="date" defaultValue={toDateInput(member?.joinedAt)} />
          <Input label="Austrittsdatum" name="leftAt" type="date" defaultValue={toDateInput(member?.leftAt)} />
          <Input label="Jahresbeitrag (EUR)" name="fee" inputMode="decimal" defaultValue={member?.fee ?? "0"} hint="0 für beitragsfreie Mitglieder" />
        </FormGrid>
        <Textarea label="Interne Notiz" name="notes" defaultValue={member?.notes ?? ""} rows={3} hint="Nur für den Vorstand sichtbar" />
      </fieldset>
      <div className="border-line flex gap-3 border-t pt-5">
        <SubmitButton>{member ? "Änderungen speichern" : "Mitglied anlegen"}</SubmitButton>
        <LinkButton href={cancelHref} variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}
