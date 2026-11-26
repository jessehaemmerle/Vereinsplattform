"use client";

import { useState } from "react";
import type { Module } from "@prisma/client";
import { ActionForm, Checkbox, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { LinkButton } from "@/components/ui/button";
import type { FormState } from "@/lib/form";
import { slugify } from "@/lib/format";
import { createClub } from "./actions";
import { MODULE_LABELS } from "@/lib/modules";

type Action = (s: FormState, f: FormData) => Promise<FormState>;

function SubdomainInput({
  defaultValue,
  baseDomain,
  onChange,
  value,
}: {
  defaultValue?: string;
  baseDomain: string;
  value?: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="slug" className="block text-sm font-medium">
        Subdomain
      </label>
      <div className="border-line bg-surface focus-within:border-loden flex items-center rounded-md border">
        <input
          id="slug"
          name="slug"
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          onChange={(e) => onChange?.(e.target.value.toLowerCase())}
          pattern="[a-z0-9](?:[a-z0-9\-]{0,38}[a-z0-9])?"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 focus:outline-none"
          autoComplete="off"
        />
        <span className="text-muted pr-3 text-sm">.{baseDomain}</span>
      </div>
      <p className="text-muted text-sm">Kleinbuchstaben, Ziffern und Bindestriche.</p>
    </div>
  );
}

export function ClubCreateForm({
  licenseOptions,
  baseDomain,
  defaults,
}: {
  licenseOptions: { value: string; label: string }[];
  baseDomain: string;
  defaults?: { name?: string; adminName?: string; adminEmail?: string };
}) {
  const [slug, setSlug] = useState(defaults?.name ? slugify(defaults.name).slice(0, 36) : "");
  const [touched, setTouched] = useState(false);
  return (
    <ActionForm action={createClub} className="max-w-2xl">
      <Input
        label="Vereinsname"
        name="name"
        required
        defaultValue={defaults?.name}
        onChange={(e) => !touched && setSlug(slugify(e.target.value).slice(0, 36))}
      />
      <SubdomainInput
        baseDomain={baseDomain}
        value={slug}
        onChange={(v) => {
          setTouched(true);
          setSlug(v);
        }}
      />
      <fieldset className="border-line space-y-5 border-t pt-5">
        <legend className="mb-1 font-semibold">Vereins-Admin</legend>
        <p className="text-muted text-sm">Bekommt eine E-Mail mit der Adresse des Vereins und einem Link zum Festlegen des Passworts.</p>
        <FormGrid>
          <Input label="Name" name="adminName" required defaultValue={defaults?.adminName} />
          <Input label="E-Mail" name="adminEmail" type="email" required defaultValue={defaults?.adminEmail} />
        </FormGrid>
      </fieldset>
      <Select
        label="Lizenz"
        name="license"
        options={[{ value: "", label: "Später zuweisen" }, ...licenseOptions]}
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

export function SlugForm({ action, slug, baseDomain }: { action: Action; slug: string; baseDomain: string }) {
  return (
    <ActionForm action={action}>
      <SubdomainInput defaultValue={slug} baseDomain={baseDomain} />
      <SubmitButton>Adresse ändern</SubmitButton>
    </ActionForm>
  );
}

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

type PlanData = {
  name: string;
  description: string;
  maxUsers: string;
  maxMembers: string;
  durationMonths: string;
  modules: Module[];
  active: boolean;
  price: string;
  publicListed: boolean;
  highlighted: boolean;
  sortOrder: string;
};

export function PlanForm({ action, plan }: { action: Action; plan?: PlanData }) {
  return (
    <ActionForm action={action} className="max-w-2xl">
      <Input label="Name" name="name" defaultValue={plan?.name} required placeholder="z. B. Basis, Plus, Premium" />
      <Textarea label="Beschreibung (intern)" name="description" defaultValue={plan?.description} rows={2} />
      <FormGrid>
        <Input label="Max. Mitglieder" name="maxMembers" type="number" min={0} defaultValue={plan?.maxMembers} hint="Leer = unbegrenzt" />
        <Input label="Max. Vorstands-Zugänge" name="maxUsers" type="number" min={0} defaultValue={plan?.maxUsers} hint="Leer = unbegrenzt" />
        <Input label="Laufzeit (Monate)" name="durationMonths" type="number" min={0} defaultValue={plan?.durationMonths ?? "12"} hint="Leer = unbegrenzt" />
      </FormGrid>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Enthaltene Module</legend>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(MODULE_LABELS) as Module[]).map((m) => (
            <Checkbox key={m} name="modules" value={m} label={MODULE_LABELS[m]} defaultChecked={plan ? plan.modules.includes(m) : true} />
          ))}
        </div>
      </fieldset>
      <Checkbox label="Für neue Lizenzen verfügbar" name="active" defaultChecked={plan?.active ?? true} />
      <fieldset className="border-line space-y-4 border-t pt-5">
        <legend className="mb-1 font-semibold">Auf der Startseite</legend>
        <FormGrid>
          <Input label="Preis pro Jahr (EUR, brutto)" name="priceCents" inputMode="decimal" defaultValue={plan?.price} hint="Leer = „auf Anfrage“" />
          <Input label="Reihenfolge" name="sortOrder" type="number" min={0} defaultValue={plan?.sortOrder ?? "0"} />
        </FormGrid>
        <Checkbox label="In der Preisliste anzeigen" name="publicListed" defaultChecked={plan?.publicListed} />
        <Checkbox label="Als Empfehlung hervorheben" name="highlighted" defaultChecked={plan?.highlighted} />
      </fieldset>
      <div className="flex gap-3">
        <SubmitButton>Paket speichern</SubmitButton>
        <LinkButton href="/admin/pakete" variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}

type LicenseData = {
  name: string;
  status: string;
  maxUsers: string;
  maxMembers: string;
  validFrom: string;
  validUntil: string;
  notes: string;
  clubId: string;
  planId: string;
};
type PlanOption = { id: string; name: string; maxUsers: number | null; maxMembers: number | null };

export function LicenseForm({
  action,
  license,
  clubs,
  plans,
}: {
  action: Action;
  license?: LicenseData;
  clubs: { id: string; name: string }[];
  plans: PlanOption[];
}) {
  const [planId, setPlanId] = useState(license?.planId ?? "");
  const [limits, setLimits] = useState({ maxMembers: license?.maxMembers ?? "", maxUsers: license?.maxUsers ?? "" });
  return (
    <ActionForm action={action} className="max-w-2xl">
      <FormGrid>
        <Input label="Bezeichnung" name="name" defaultValue={license?.name} required placeholder="z. B. Plus 2027" />
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
        <Select
          label="Paket"
          name="planId"
          value={planId}
          onChange={(e) => {
            setPlanId(e.target.value);
            const p = plans.find((x) => x.id === e.target.value);
            if (p) setLimits({ maxMembers: p.maxMembers?.toString() ?? "", maxUsers: p.maxUsers?.toString() ?? "" });
          }}
          options={[{ value: "", label: "Ohne Paket (individuell)" }, ...plans.map((p) => ({ value: p.id, label: p.name }))]}
          hint="Übernimmt die Limits des Pakets"
        />
        <Select
          label="Verein"
          name="clubId"
          defaultValue={license?.clubId ?? ""}
          options={[{ value: "", label: "Nicht zugewiesen" }, ...clubs.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <Input
          label="Max. Mitglieder"
          name="maxMembers"
          type="number"
          min={0}
          value={limits.maxMembers}
          onChange={(e) => setLimits({ ...limits, maxMembers: e.target.value })}
          hint="Leer = unbegrenzt"
        />
        <Input
          label="Max. Vorstands-Zugänge"
          name="maxUsers"
          type="number"
          min={0}
          value={limits.maxUsers}
          onChange={(e) => setLimits({ ...limits, maxUsers: e.target.value })}
          hint="Leer = unbegrenzt"
        />
        <Input label="Gültig ab" name="validFrom" type="date" defaultValue={license?.validFrom} />
        <Input label="Gültig bis" name="validUntil" type="date" defaultValue={license?.validUntil} hint="Leer = unbegrenzt" />
      </FormGrid>
      {planId && <Checkbox name="applyPlanModules" label="Module des Pakets beim Verein einstellen" />}
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
