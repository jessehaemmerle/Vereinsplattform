import Papa from "papaparse";

/** Prevents spreadsheet formula injection from user-entered text. */
export function neutralize(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /^[=+\-@\t\r]/.test(text) && !/^-?\d+([.,]\d+)?$/.test(text) ? `'${text}` : text;
}

export function csvResponse(filename: string, rows: (string | number | null | undefined)[][]) {
  const body =
    "﻿" +
    Papa.unparse(
      rows.map((r) => r.map((c) => (c ?? "") as string)),
      { delimiter: ";" },
    );
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
