import { CSV_TEMPLATE } from "@/lib/member-csv";

export function GET() {
  return new Response("﻿" + CSV_TEMPLATE, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="mitglieder-vorlage.csv"' },
  });
}
