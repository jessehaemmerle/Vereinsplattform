"use client";

import { ActionForm, Checkbox, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { changePassword, inviteUser, updateClub, updateMfaPolicy, updateProfile } from "./actions";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

export function ClubForm({
  club,
}: {
  club: { name: string; email: string | null; address: string | null; iban: string | null; bankName: string | null; openingBalance: string };
}) {
  return (
    <ActionForm action={updateClub}>
      <FormGrid>
        <Input label="Vereinsname" name="name" defaultValue={club.name} required />
        <Input label="Kontakt-E-Mail" name="email" type="email" defaultValue={club.email ?? ""} hint="Antworten auf Rundschreiben gehen hierhin" />
      </FormGrid>
      <Textarea label="Anschrift" name="address" defaultValue={club.address ?? ""} rows={2} />
      <FormGrid>
        <Input label="IBAN" name="iban" defaultValue={club.iban ?? ""} />
        <Input label="Bank" name="bankName" defaultValue={club.bankName ?? ""} />
        <Input
          label="Anfangsbestand der Kassa (EUR)"
          name="openingBalance"
          inputMode="decimal"
          defaultValue={club.openingBalance}
          hint="Kassastand vor der ersten erfassten Buchung"
        />
      </FormGrid>
      <SubmitButton>Vereinsdaten speichern</SubmitButton>
    </ActionForm>
  );
}

export function InviteForm() {
  const roles = (["ADMIN", "KASSIER", "SCHRIFTFUEHRER", "VORSTAND"] as const).map((r) => ({ value: r, label: `${ROLE_LABELS[r]} – ${ROLE_DESCRIPTIONS[r]}` }));
  return (
    <ActionForm action={inviteUser} resetOnOk>
      <FormGrid>
        <Input label="Name" name="name" required />
        <Input label="E-Mail" name="email" type="email" required />
      </FormGrid>
      <Select label="Rolle" name="role" defaultValue="VORSTAND" options={roles} />
      <SubmitButton pendingText="Wird gesendet …">Einladung senden</SubmitButton>
    </ActionForm>
  );
}

export function ProfileForm({ name, emailNotifications }: { name: string; emailNotifications: boolean }) {
  return (
    <ActionForm action={updateProfile}>
      <Input label="Name" name="name" defaultValue={name} required />
      <Checkbox label="E-Mails vom Verein erhalten" name="emailNotifications" defaultChecked={emailNotifications} />
      <SubmitButton>Profil speichern</SubmitButton>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePassword} resetOnOk>
      <Input label="Aktuelles Passwort" name="current" type="password" autoComplete="current-password" required />
      <FormGrid>
        <Input label="Neues Passwort" name="password" type="password" autoComplete="new-password" required minLength={10} />
        <Input label="Wiederholen" name="confirm" type="password" autoComplete="new-password" required />
      </FormGrid>
      <SubmitButton>Passwort ändern</SubmitButton>
    </ActionForm>
  );
}

export function MfaPolicyForm({ policy }: { policy: string }) {
  return (
    <ActionForm action={updateMfaPolicy}>
      <Select
        label="Wer muss einen zweiten Faktor (App oder Passkey) verwenden?"
        name="mfaPolicy"
        defaultValue={policy}
        options={[
          { value: "OPTIONAL", label: "Niemand – jede Person entscheidet selbst" },
          { value: "BOARD", label: "Alle Vorstandszugänge (empfohlen)" },
          { value: "ALL", label: "Alle, auch Mitglieder" },
        ]}
        hint="Wer noch keinen zweiten Faktor hat, wird bei der nächsten Seite zur Einrichtung aufgefordert."
      />
      <SubmitButton>Speichern</SubmitButton>
    </ActionForm>
  );
}
