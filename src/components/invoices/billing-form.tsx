"use client";

import { ActionForm, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { TAX_MODE_LABELS } from "@/lib/invoice-calc";
import type { FormState } from "@/lib/form";

type Values = {
  taxMode: string;
  invoicePrefix: string;
  paymentTermsDays: number;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  invoiceFooter: string | null;
  vatId?: string | null;
};

export function BillingForm({
  action,
  values,
  withVatId,
  vatIdHint,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  values: Values;
  withVatId?: boolean;
  vatIdHint?: string;
}) {
  return (
    <ActionForm action={action} className="max-w-3xl">
      <Select
        label="Umsatzsteuer"
        name="taxMode"
        defaultValue={values.taxMode}
        options={Object.entries(TAX_MODE_LABELS).map(([value, label]) => ({ value, label }))}
        hint="Im Zweifel mit Steuerberatung abklären. Gemeinnützige Vereine sind mit vielen Einnahmen nicht steuerbar, mit wirtschaftlichen Tätigkeiten (z. B. Feste) aber unter Umständen schon."
      />
      <FormGrid>
        {withVatId && (
          <Input
            label="UID-Nummer"
            name="vatId"
            defaultValue={values.vatId ?? ""}
            placeholder="ATU12345678"
            hint="Pflicht bei umsatzsteuerpflichtigen Rechnungen"
          />
        )}
        <Input label="Nummernkreis-Präfix" name="invoicePrefix" defaultValue={values.invoicePrefix} hint="Ergibt z. B. RE-2026-0001" />
        <Input label="Zahlungsziel (Tage)" name="paymentTermsDays" type="number" min={0} max={120} defaultValue={values.paymentTermsDays} />
        <Input label="IBAN" name="iban" defaultValue={values.iban ?? ""} hint="Für Überweisung und QR-Code auf der Rechnung" />
        <Input label="BIC (optional)" name="bic" defaultValue={values.bic ?? ""} />
        <Input label="Bank" name="bankName" defaultValue={values.bankName ?? ""} />
      </FormGrid>
      {!withVatId && vatIdHint && <p className="text-muted text-sm">{vatIdHint}</p>}
      <Textarea
        label="Fußzeile (optional)"
        name="invoiceFooter"
        rows={2}
        defaultValue={values.invoiceFooter ?? ""}
        placeholder="z. B. ZVR-Zahl, Bankverbindung, Kontaktperson"
      />
      <SubmitButton>Einstellungen speichern</SubmitButton>
    </ActionForm>
  );
}
