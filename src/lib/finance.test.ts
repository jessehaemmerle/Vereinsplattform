import { describe, expect, it } from "vitest";
import { balance, categorySums, yearSummaries, type TxLike } from "./finance";

const tx = (type: TxLike["type"], amount: number, date: string, category = "X"): TxLike => ({ type, amount, date: new Date(date), category });

describe("yearSummaries", () => {
  it("carries the closing balance into the next year", () => {
    const rows = yearSummaries([tx("EINNAHME", 100.1, "2024-03-01"), tx("AUSGABE", 30.05, "2024-05-01"), tx("EINNAHME", 10, "2025-01-01")], "50");
    expect(rows).toEqual([
      { year: 2024, opening: 50, income: 100.1, expense: 30.05, closing: 120.05 },
      { year: 2025, opening: 120.05, income: 10, expense: 0, closing: 130.05 },
    ]);
  });

  it("avoids floating point drift", () => {
    const many = Array.from({ length: 10 }, () => tx("EINNAHME", 0.1, "2024-01-01"));
    expect(balance(many, 0)).toBe(1);
  });
});

describe("categorySums", () => {
  it("groups by type and category, income first", () => {
    const sums = categorySums([tx("AUSGABE", 5, "2024-01-01", "Miete"), tx("EINNAHME", 7, "2024-01-01", "Spende"), tx("EINNAHME", 3, "2024-01-02", "Spende")]);
    expect(sums).toEqual([
      { category: "Spende", type: "EINNAHME", total: 10, count: 2 },
      { category: "Miete", type: "AUSGABE", total: 5, count: 1 },
    ]);
  });
});
