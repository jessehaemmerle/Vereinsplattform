import { describe, expect, it } from "vitest";
import { parseAmount, parseFlexibleDate, parseMemberCsv } from "./member-csv";

describe("parseMemberCsv", () => {
  it("reads semicolon files with German formats and reports bad rows", () => {
    const csv =
      "﻿Vorname;Nachname;Email;Geburtstag;Mitgliedsbeitrag;Status\nMax;Muster;MAX@Example.com;15.05.1990;1.250,50;passiv\n;Ohne;x@y.at;;;\nEva;Fehler;keine-mail;;;\n";
    const { rows, errors } = parseMemberCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ firstName: "Max", email: "max@example.com", fee: 1250.5, status: "PASSIV" });
    expect(rows[0].birthday?.toISOString()).toBe("1990-05-15T00:00:00.000Z");
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain("Zeile 3");
  });

  it("accepts the legacy comma format of the old app", () => {
    const csv =
      "Vorname,Nachname,Email,Mitgliedsbeitrag,Beitrag_Bezahlt,Eintrittsdatum,Geburtstag,Status,Funktion,Telefonnummer,Adresse,PLZ,Ort\nAnna,Schmidt,anna@example.com,75.50,nein,2022-06-15,1985-07-22,aktiv,Kassierer,0987,Weg 3,54321,Stadt\n";
    const { rows, errors } = parseMemberCsv(csv);
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ fee: 75.5, phone: "0987", street: "Weg 3", function: "Kassierer" });
  });
});

describe("helpers", () => {
  it("parses dates and amounts", () => {
    expect(parseFlexibleDate("2024-12-31")?.toISOString()).toBe("2024-12-31T00:00:00.000Z");
    expect(parseFlexibleDate("31.12.2024")?.getUTCDate()).toBe(31);
    expect(parseFlexibleDate("morgen")).toBeNull();
    expect(parseAmount("12,5")).toBe(12.5);
    expect(parseAmount("€ 40")).toBe(40);
    expect(parseAmount("abc")).toBeNaN();
  });
});
