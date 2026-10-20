"use client";

import type { Module } from "@prisma/client";
import { ActionForm, Checkbox, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import type { FormState } from "@/lib/form";
import { createClub } from "./actions";

type Action = (s: FormState, f: FormData) => Promise<FormState>;

export function ClubCreateForm({ licenses }: { licenses: { id: string; label: string }[] }) {
  return (
    <ActionForm action={createClub} className="max-w-2xl">
      <Input label="Vereinsname" name="name" required />
      <fieldset className="border-line space-y-5 border-t pt-5">
        <legend className="mb-1 font-semibold">Vereins-Admin</legend>
        <p className="text-muted text-sm">Bekommt eine E-Mail mit einem Link und legt sein Passwort selbst fest.</p>
        <FormGrid>
          <Input label="Name" name="adminName" required />
          <Input label="E-Mail" name="adminEmail" type="email" required />
        </FormGrid>
      </fieldset>
      <Select
        label="Lizenz zuweisen"
        name="licenseId"
        options={[{ value: "", label: "Später zuweisen" }, ...licenses.map((l) => ({ value: l.id, label: l.label }))]}
        hint="Ohne gültige Lizenz kann der Verein nichts ändern."
      />
      <div className="flex gap-3">
        <SubmitButton>Verein anlegen</SubmitButton>
        <LinkButton href="/admin" variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}

const MODULE_LABELS: Record<Module, string> = {
  MITGLIEDER: "Mitglieder",
  FINANZEN: "Finanzen",
  EVENTS: "Termine",
  NOTIZEN: "Notizen",
  DOKUMENTE: "Dokumente",
  KOMMUNIKATION: "Nachrichten",
};

export function ModulesForm({ action, modules }: { action: Action; modules: Module[] }) {
  return (
    <ActionForm action={action}>
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(MODULE_LABELS) as Module[]).map((m) => (
          <Checkbox key={m} name="modules" value={m} label={MODULE_LABELS[m]} defaultChecked={modules.includes(m)} />
        ))}
      </div>
      <SubmitButton>Module speichern</SubmitButton>
    </ActionForm>
  );
}

type LicenseData = { name: string; status: string; maxUsers: string; maxMembers: string; validFrom: string; validUntil: string; notes: string; clubId: string };

export function LicenseForm({ action, license, clubs }: { action: Action; license?: LicenseData; clubs: { id: string; name: string }[] }) {
  return (
    <ActionForm action={action} className="max-w-2xl">
      <FormGrid>
        <Input label="Bezeichnung" name="name" defaultValue={license?.name} required placeholder="z. B. Standard 2026" />
        <Select
          label="Status"
          name="status"
          defaultValue={license?.status ?? "ACTIVE"}
          options={[
            { value: "ACTIVE", label: "Aktiv" },
            { value: "TRIAL", label: "Test" },
            { value: "SUSPENDED", label: "Gesperrt" },
            { value: "EXPIRED", label: "Abgelaufen" },
          ]}
        />
        <Input label="Max. Mitglieder" name="maxMembers" type="number" min={0} defaultValue={license?.maxMembers} hint="Leer = unbegrenzt" />
        <Input label="Max. Vorstands-Zugänge" name="maxUsers" type="number" min={0} defaultValue={license?.maxUsers} hint="Leer = unbegrenzt" />
        <Input label="Gültig ab" name="validFrom" type="date" defaultValue={license?.validFrom} />
        <Input label="Gültig bis" name="validUntil" type="date" defaultValue={license?.validUntil} />
      </FormGrid>
      <Select
        label="Verein"
        name="clubId"
        defaultValue={license?.clubId ?? ""}
        options={[{ value: "", label: "Nicht zugewiesen" }, ...clubs.map((c) => ({ value: c.id, label: c.name }))]}
      />
      <Textarea label="Notizen" name="notes" defaultValue={license?.notes} rows={3} />
      <div className="flex gap-3">
        <SubmitButton>Lizenz speichern</SubmitButton>
        <LinkButton href="/admin/lizenzen" variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}
