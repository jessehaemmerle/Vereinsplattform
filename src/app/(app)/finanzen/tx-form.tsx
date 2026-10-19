"use client";

import { useState } from "react";
import { ActionForm, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import type { FormState } from "@/lib/form";
import { DEFAULT_CATEGORIES } from "@/lib/finance";

type Tx = { type: "EINNAHME" | "AUSGABE"; category: string; amount: string; date: string; description: string | null; memberId: string | null };

export function TxForm({
  action,
  tx,
  members,
  usedCategories,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  tx?: Tx;
  members: { id: string; name: string }[];
  usedCategories: string[];
}) {
  const [type, setType] = useState<Tx["type"]>(tx?.type ?? "EINNAHME");
  const suggestions = [...new Set([...DEFAULT_CATEGORIES[type], ...usedCategories])];
  return (
    <ActionForm action={action} className="max-w-2xl">
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Art</legend>
        <div className="border-line bg-surface inline-flex rounded-md border p-1">
          {(["EINNAHME", "AUSGABE"] as const).map((t) => (
            <label
              key={t}
              className="has-[:checked]:bg-loden dark:has-[:checked]:text-paper cursor-pointer rounded px-4 py-1.5 text-sm has-[:checked]:text-white"
            >
              <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="sr-only" />
              {t === "EINNAHME" ? "Einnahme" : "Ausgabe"}
            </label>
          ))}
        </div>
      </fieldset>
      <FormGrid>
        <Input label="Betrag (EUR)" name="amount" inputMode="decimal" defaultValue={tx?.amount} required placeholder="0,00" />
        <Input label="Datum" name="date" type="date" defaultValue={tx?.date ?? new Date().toISOString().slice(0, 10)} required />
        <Input label="Kategorie" name="category" list="categories" defaultValue={tx?.category} required autoComplete="off" />
        <Select
          label="Mitglied (optional)"
          name="memberId"
          defaultValue={tx?.memberId ?? ""}
          options={[{ value: "", label: "Kein Mitglied" }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        />
      </FormGrid>
      <datalist id="categories">
        {suggestions.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <Textarea label="Beschreibung" name="description" defaultValue={tx?.description ?? ""} rows={3} />
      <div className="flex gap-3">
        <SubmitButton>{tx ? "Buchung speichern" : "Buchung anlegen"}</SubmitButton>
        <LinkButton href="/finanzen" variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}
