"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { TaxMode } from "@prisma/client";
import { ActionForm, Checkbox, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/ui/form";
import { Button, LinkButton } from "@/components/ui/button";
import { computeTotals, TAX_RATES, taxNote } from "@/lib/invoice-calc";
import type { FormState } from "@/lib/form";

export type RecipientOption = {
  key: string;
  label: string;
  name: string;
  address: string | null;
  email: string | null;
  vatId: string | null;
  ref: { field: "recipientClubId" | "recipientContactId" | "recipientMemberId"; id: string };
};

type Item = { description: string; quantity: string; unit: string; price: string; taxRate: number };

export type InvoiceDraft = {
  recipientKey?: string;
  recipientName: string;
  recipientAddress: string;
  recipientEmail: string;
  recipientVatId: string;
  servicePeriod: string;
  intro: string;
  notes: string;
  items: Item[];
};

const toCents = (v: string) =>
  Math.round(
    Number(
      v
        .replace(/\s/g, "")
        .replace(/\.(?=.*,)/g, "")
        .replace(",", "."),
    ) * 100,
  ) || 0;
const toNumber = (v: string) => Number(v.replace(",", ".")) || 0;
const eur = (c: number) => new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(c / 100);

export function InvoiceEditor({
  action,
  taxMode,
  recipients,
  initial,
  cancelHref,
  allowSaveContact,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  taxMode: TaxMode;
  recipients: RecipientOption[];
  initial?: InvoiceDraft;
  cancelHref: string;
  allowSaveContact?: boolean;
}) {
  const taxable = taxMode === "STEUERPFLICHTIG";
  const defaultRate = taxable ? 20 : 0;
  const [recipientKey, setRecipientKey] = useState(initial?.recipientKey ?? "");
  const [recipient, setRecipient] = useState({
    name: initial?.recipientName ?? "",
    address: initial?.recipientAddress ?? "",
    email: initial?.recipientEmail ?? "",
    vatId: initial?.recipientVatId ?? "",
  });
  const [items, setItems] = useState<Item[]>(
    initial?.items.length ? initial.items : [{ description: "", quantity: "1", unit: "", price: "", taxRate: defaultRate }],
  );
  const selected = recipients.find((r) => r.key === recipientKey);
  const totals = useMemo(
    () =>
      computeTotals(
        items.map((i) => ({ quantity: toNumber(i.quantity), unitCents: toCents(i.price), taxRate: i.taxRate })),
        taxMode,
      ),
    [items, taxMode],
  );
  const update = (idx: number, patch: Partial<Item>) => setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const cell = "border-line bg-surface focus:border-loden w-full rounded-md border px-2 py-1.5 text-sm focus:outline-none";

  return (
    <ActionForm action={action} className="max-w-5xl">
      <fieldset className="space-y-5">
        <legend className="mb-3 font-semibold">Empfänger</legend>
        {recipients.length > 0 && (
          <Select
            label="Aus Adressbuch übernehmen"
            name="_recipient"
            value={recipientKey}
            onChange={(e) => {
              const r = recipients.find((x) => x.key === e.target.value);
              setRecipientKey(e.target.value);
              if (r) setRecipient({ name: r.name, address: r.address ?? "", email: r.email ?? "", vatId: r.vatId ?? "" });
            }}
            options={[{ value: "", label: "Neuer Empfänger – Daten unten eingeben" }, ...recipients.map((r) => ({ value: r.key, label: r.label }))]}
          />
        )}
        {selected && <input type="hidden" name={selected.ref.field} value={selected.ref.id} />}
        <FormGrid>
          <Input
            label="Name / Firma"
            name="recipientName"
            required
            value={recipient.name}
            onChange={(e) => setRecipient({ ...recipient, name: e.target.value })}
          />
          <Input
            label="E-Mail (für den Versand)"
            name="recipientEmail"
            type="email"
            value={recipient.email}
            onChange={(e) => setRecipient({ ...recipient, email: e.target.value })}
          />
          <Textarea
            label="Anschrift"
            name="recipientAddress"
            rows={3}
            value={recipient.address}
            onChange={(e) => setRecipient({ ...recipient, address: e.target.value })}
            placeholder={"Straße 1\n1234 Ort"}
          />
          <Input
            label="UID des Empfängers"
            name="recipientVatId"
            value={recipient.vatId}
            onChange={(e) => setRecipient({ ...recipient, vatId: e.target.value })}
            hint="Pflicht bei Rechnungen über 10.000 € brutto an Unternehmen"
          />
        </FormGrid>
        {allowSaveContact && !selected && <Checkbox name="saveContact" label="Empfänger im Adressbuch speichern" />}
      </fieldset>

      <fieldset className="border-line space-y-4 border-t pt-5">
        <legend className="mb-3 font-semibold">Positionen</legend>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-muted text-left">
              <tr>
                <th className="pb-2 font-medium">Beschreibung</th>
                <th className="w-20 pb-2 font-medium">Menge</th>
                <th className="w-28 pb-2 font-medium">Einheit</th>
                <th className="w-32 pb-2 font-medium">{taxable ? "Einzel netto (€)" : "Einzelpreis (€)"}</th>
                {taxable && <th className="w-20 pb-2 font-medium">USt</th>}
                <th className="w-28 pb-2 text-right font-medium">Betrag</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="align-top">
                  <td className="py-1 pr-2">
                    <input
                      name={`items[${idx}][description]`}
                      required
                      value={it.description}
                      onChange={(e) => update(idx, { description: e.target.value })}
                      className={cell}
                      aria-label={`Beschreibung Position ${idx + 1}`}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      name={`items[${idx}][quantity]`}
                      required
                      inputMode="decimal"
                      value={it.quantity}
                      onChange={(e) => update(idx, { quantity: e.target.value })}
                      className={cell}
                      aria-label={`Menge Position ${idx + 1}`}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      name={`items[${idx}][unit]`}
                      value={it.unit}
                      onChange={(e) => update(idx, { unit: e.target.value })}
                      className={cell}
                      placeholder="Stück"
                      aria-label={`Einheit Position ${idx + 1}`}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <input
                      name={`items[${idx}][unitCents]`}
                      required
                      inputMode="decimal"
                      value={it.price}
                      onChange={(e) => update(idx, { price: e.target.value })}
                      className={cell}
                      placeholder="0,00"
                      aria-label={`Preis Position ${idx + 1}`}
                    />
                  </td>
                  {taxable ? (
                    <td className="py-1 pr-2">
                      <select
                        name={`items[${idx}][taxRate]`}
                        value={it.taxRate}
                        onChange={(e) => update(idx, { taxRate: Number(e.target.value) })}
                        className={cell}
                        aria-label={`Steuersatz Position ${idx + 1}`}
                      >
                        {TAX_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r} %
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : (
                    <input type="hidden" name={`items[${idx}][taxRate]`} value="0" />
                  )}
                  <td className="py-2.5 text-right whitespace-nowrap">{eur(totals.lines[idx] ?? 0)}</td>
                  <td className="py-1 text-right">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setItems((l) => l.filter((_, i) => i !== idx))}
                        className="text-muted hover:text-danger p-1.5"
                        aria-label={`Position ${idx + 1} entfernen`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setItems((l) => [...l, { description: "", quantity: "1", unit: "", price: "", taxRate: defaultRate }])}
        >
          <Plus className="size-4" /> Position hinzufügen
        </Button>
        <div className="ml-auto w-full max-w-sm space-y-1 text-sm">
          {taxable && (
            <>
              <p className="flex justify-between">
                <span className="text-muted">Summe netto</span> {eur(totals.netCents)}
              </p>
              {totals.groups.map((g) => (
                <p key={g.rate} className="flex justify-between">
                  <span className="text-muted">USt {g.rate} %</span> {eur(g.taxCents)}
                </p>
              ))}
            </>
          )}
          <p className="border-line flex justify-between border-t pt-1 text-base font-semibold">
            <span>Gesamt</span> {eur(totals.grossCents)}
          </p>
          {taxNote(taxMode) && <p className="text-muted text-xs">{taxNote(taxMode)}</p>}
        </div>
      </fieldset>

      <fieldset className="border-line space-y-5 border-t pt-5">
        <legend className="mb-3 font-semibold">Texte</legend>
        <Input
          label="Leistungsdatum / -zeitraum"
          name="servicePeriod"
          defaultValue={initial?.servicePeriod}
          placeholder="z. B. 15.06.2026 oder 01.01.–31.12.2026"
          hint="Pflichtangabe auf jeder Rechnung"
        />
        <Textarea
          label="Einleitung (optional)"
          name="intro"
          rows={2}
          defaultValue={initial?.intro}
          placeholder="Vielen Dank für die Zusammenarbeit. Wir erlauben uns, folgende Leistungen zu verrechnen:"
        />
        <Textarea label="Anmerkungen (optional)" name="notes" rows={2} defaultValue={initial?.notes} />
      </fieldset>

      <div className="flex gap-3">
        <SubmitButton>Entwurf speichern</SubmitButton>
        <LinkButton href={cancelHref} variant="ghost">
          Abbrechen
        </LinkButton>
      </div>
    </ActionForm>
  );
}
