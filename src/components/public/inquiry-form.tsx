"use client";

import { ActionForm, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { submitInquiry } from "@/app/(public)/actions";

export function InquiryForm({ token, plans, planId }: { token: string; plans: { id: string; name: string }[]; planId?: string }) {
  return (
    <ActionForm action={submitInquiry} resetOnOk className="max-w-2xl">
      <input type="hidden" name="t" value={token} />
      {/* honeypot: invisible for people, irresistible for bots */}
      <div aria-hidden className="absolute -left-[9999px]">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <FormGrid>
        <Input label="Name des Vereins" name="clubName" required autoComplete="organization" />
        <Input label="Ungefähre Mitgliederzahl" name="members" type="number" min={0} inputMode="numeric" />
        <Input label="Dein Name" name="name" required autoComplete="name" />
        <Input label="E-Mail" name="email" type="email" required autoComplete="email" />
        <Input label="Telefon (optional)" name="phone" type="tel" autoComplete="tel" />
        {plans.length > 0 && (
          <Select
            label="Interesse an"
            name="planId"
            defaultValue={plans.some((p) => p.id === planId) ? planId : ""}
            options={[{ value: "", label: "Noch offen" }, ...plans.map((p) => ({ value: p.id, label: p.name }))]}
          />
        )}
      </FormGrid>
      <Textarea label="Nachricht (optional)" name="message" rows={4} placeholder="Was nutzt ihr heute? Was soll besser werden?" />
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="consent" required className="mt-0.5 size-4 accent-[var(--loden)]" />
        <span>
          Ich habe die{" "}
          <a href="/datenschutz" target="_blank" className="text-loden underline-offset-4 hover:underline">
            Datenschutzerklärung
          </a>{" "}
          gelesen. Meine Angaben werden nur zur Bearbeitung dieser Anfrage verwendet.
        </span>
      </label>
      <SubmitButton pendingText="Wird gesendet …">Anfrage senden</SubmitButton>
    </ActionForm>
  );
}
