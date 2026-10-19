"use client";

import { ActionForm, Input, SubmitButton } from "@/components/ui/form";
import { updateOwnContact } from "./actions";

export function ContactForm({ member }: { member: { phone: string | null; street: string | null; zip: string | null; city: string | null } }) {
  return (
    <ActionForm action={updateOwnContact}>
      <Input label="Telefon" name="phone" defaultValue={member.phone ?? ""} autoComplete="tel" />
      <Input label="Straße und Hausnummer" name="street" defaultValue={member.street ?? ""} autoComplete="street-address" />
      <div className="grid grid-cols-[7rem_1fr] gap-4">
        <Input label="PLZ" name="zip" defaultValue={member.zip ?? ""} autoComplete="postal-code" />
        <Input label="Ort" name="city" defaultValue={member.city ?? ""} autoComplete="address-level2" />
      </div>
      <SubmitButton>Speichern</SubmitButton>
    </ActionForm>
  );
}
