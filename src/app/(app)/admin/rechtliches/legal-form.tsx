"use client";

import type { PlatformSettings } from "@prisma/client";
import { ActionForm, FormGrid, Input, SubmitButton } from "@/components/ui/form";
import { saveLegal } from "../actions";

export function LegalForm({ s }: { s: PlatformSettings }) {
  const v = (k: keyof PlatformSettings) => (s[k] as string | null) ?? "";
  return (
    <ActionForm action={saveLegal} className="max-w-3xl">
      <fieldset className="space-y-5">
        <legend className="mb-3 font-semibold">Betreiber (Impressum)</legend>
        <FormGrid>
          <Input label="Name bzw. Firma *" name="operatorName" defaultValue={v("operatorName")} hint="Wie im Gewerbe- bzw. Firmenbuch" />
          <Input label="Rechtsform" name="legalForm" defaultValue={v("legalForm")} placeholder="Einzelunternehmen, GmbH …" />
          <Input label="Straße und Hausnummer *" name="street" defaultValue={v("street")} />
          <Input label="PLZ und Ort *" name="zipCity" defaultValue={v("zipCity")} />
          <Input label="Land" name="country" defaultValue={v("country")} />
          <Input label="E-Mail *" name="email" type="email" defaultValue={v("email")} />
          <Input label="Telefon" name="phone" defaultValue={v("phone")} />
          <Input label="UID-Nummer" name="vatId" defaultValue={v("vatId")} placeholder="ATU12345678" />
          <Input
            label="Firmenbuch"
            name="companyRegister"
            defaultValue={v("companyRegister")}
            placeholder="FN 123456a, Landesgericht Linz"
            hint="Nur bei eingetragenen Unternehmen"
          />
          <Input label="Vertretungsbefugt" name="representative" defaultValue={v("representative")} hint="z. B. Geschäftsführer:in" />
        </FormGrid>
        <Input
          label="Unternehmensgegenstand *"
          name="businessPurpose"
          defaultValue={v("businessPurpose")}
          placeholder="Entwicklung und Betrieb von Software für Vereine"
        />
        <FormGrid>
          <Input label="Gewerbebehörde" name="authority" defaultValue={v("authority")} placeholder="Bezirkshauptmannschaft …" />
          <Input label="Kammer / Berufsrecht" name="chamber" defaultValue={v("chamber")} placeholder="WKO Oberösterreich, GewO (ris.bka.gv.at)" />
        </FormGrid>
      </fieldset>
      <fieldset className="border-line space-y-5 border-t pt-5">
        <legend className="mb-3 font-semibold">Dienstleister (Datenschutzerklärung)</legend>
        <Input
          label="Hosting *"
          name="hostingProvider"
          defaultValue={v("hostingProvider")}
          placeholder="Hetzner Online GmbH, Rechenzentrum Falkenstein (Deutschland)"
        />
        <Input label="E-Mail-Versand" name="mailProvider" defaultValue={v("mailProvider")} placeholder="Brevo (Sendinblue SAS), Paris, Frankreich" />
      </fieldset>
      <fieldset className="border-line space-y-5 border-t pt-5">
        <legend className="mb-3 font-semibold">Anfragen von der Startseite</legend>
        <Input label="Anfragen senden an" name="contactEmail" type="email" defaultValue={v("contactEmail")} hint="Leer = an alle Plattform-Admins" />
      </fieldset>
      <SubmitButton>Speichern</SubmitButton>
    </ActionForm>
  );
}
