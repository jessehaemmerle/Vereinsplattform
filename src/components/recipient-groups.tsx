import { Checkbox } from "@/components/ui/form";

const GROUPS = [
  ["AKTIV", "Aktive Mitglieder"],
  ["PASSIV", "Passive Mitglieder"],
  ["EHRENMITGLIED", "Ehrenmitglieder"],
] as const;

export function RecipientGroups({ counts }: { counts: Record<string, number> }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Empfänger</legend>
      {GROUPS.map(([value, label]) => (
        <Checkbox key={value} name="statuses" value={value} label={`${label} (${counts[value] ?? 0})`} defaultChecked={value === "AKTIV"} />
      ))}
    </fieldset>
  );
}
