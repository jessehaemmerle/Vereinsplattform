"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

const MODES = [
  { value: "draft", label: "als Entwurf anlegen (zum Prüfen)" },
  { value: "issue", label: "sofort ausstellen" },
  { value: "issueSend", label: "ausstellen und per E-Mail senden" },
];

function RunButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <Play className="size-4" /> {pending ? "Wird erstellt …" : children}
    </Button>
  );
}

/**
 * Selection form of a billing run: the table rows carry checkboxes named "ids"; a row button
 * named "only" bills just that row. Mode and submit sit in the bar below the table.
 */
export function BillingRunForm({
  action,
  children,
  hidden,
  submitLabel,
  selectable,
}: {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  hidden?: Record<string, string>;
  submitLabel: string;
  selectable: number;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        const count = data.get("only") ? 1 : data.getAll("ids").length;
        if (!count) {
          e.preventDefault();
          window.alert("Bitte zuerst mindestens eine Zeile auswählen.");
          return;
        }
        if (data.get("mode") === "issueSend" && !window.confirm(`${count} Rechnung(en) ausstellen und sofort per E-Mail senden?`)) e.preventDefault();
      }}
    >
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      {selectable > 0 && (
        <div className="border-line bg-surface mt-4 flex flex-wrap items-end gap-3 rounded-lg border p-4">
          <label className="text-sm">
            <span className="text-muted mb-1 block">Erstellte Rechnungen</span>
            <select name="mode" defaultValue="draft" className="border-line bg-paper h-10 rounded-md border px-3 text-[15px]">
              {MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <RunButton>{submitLabel}</RunButton>
        </div>
      )}
    </form>
  );
}

/** Header checkbox that (de)selects every row checkbox of the surrounding form. */
export function SelectAll() {
  return (
    <input
      type="checkbox"
      aria-label="Alle auswählen"
      defaultChecked
      className="size-4 accent-[var(--loden)]"
      onChange={(e) => {
        e.currentTarget.form?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((box) => (box.checked = e.currentTarget.checked));
      }}
    />
  );
}

export function RowCheckbox({ value, label }: { value: string; label: string }) {
  return <input type="checkbox" name="ids" value={value} defaultChecked aria-label={label} className="size-4 accent-[var(--loden)]" />;
}
