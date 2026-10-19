import { toNumber } from "@/lib/format";

export type TxLike = { type: "EINNAHME" | "AUSGABE"; amount: unknown; date: Date; category: string };

const cents = (v: unknown) => Math.round(toNumber(v as number) * 100);

export function signedCents(tx: TxLike) {
  return tx.type === "EINNAHME" ? cents(tx.amount) : -cents(tx.amount);
}

export type YearSummary = { year: number; opening: number; income: number; expense: number; closing: number };

/** Per-year balances; each year opens with the previous year's closing balance. */
export function yearSummaries(transactions: TxLike[], openingBalance: unknown): YearSummary[] {
  const byYear = new Map<number, { income: number; expense: number }>();
  for (const tx of transactions) {
    const year = tx.date.getUTCFullYear();
    const row = byYear.get(year) ?? { income: 0, expense: 0 };
    if (tx.type === "EINNAHME") row.income += cents(tx.amount);
    else row.expense += cents(tx.amount);
    byYear.set(year, row);
  }
  let running = cents(openingBalance);
  return [...byYear.keys()]
    .sort((a, b) => a - b)
    .map((year) => {
      const { income, expense } = byYear.get(year)!;
      const opening = running;
      running = opening + income - expense;
      return { year, opening: opening / 100, income: income / 100, expense: expense / 100, closing: running / 100 };
    });
}

export function balance(transactions: TxLike[], openingBalance: unknown) {
  return (cents(openingBalance) + transactions.reduce((sum, tx) => sum + signedCents(tx), 0)) / 100;
}

export type CategorySum = { category: string; type: "EINNAHME" | "AUSGABE"; total: number; count: number };

export function categorySums(transactions: TxLike[]): CategorySum[] {
  const map = new Map<string, CategorySum>();
  for (const tx of transactions) {
    const key = `${tx.type}:${tx.category}`;
    const row = map.get(key) ?? { category: tx.category, type: tx.type, total: 0, count: 0 };
    row.total += cents(tx.amount);
    row.count++;
    map.set(key, row);
  }
  return [...map.values()]
    .map((r) => ({ ...r, total: r.total / 100 }))
    .sort((a, b) => (a.type === b.type ? b.total - a.total : a.type === "EINNAHME" ? -1 : 1));
}

export const DEFAULT_CATEGORIES = {
  EINNAHME: ["Mitgliedsbeitrag", "Spende", "Förderung", "Veranstaltung", "Sponsoring", "Sonstiges"],
  AUSGABE: ["Eventkosten", "Material", "Miete", "Versicherung", "Gebühren", "Verwaltung", "Sonstiges"],
} as const;

export const TX_LABELS = { EINNAHME: "Einnahme", AUSGABE: "Ausgabe" } as const;
