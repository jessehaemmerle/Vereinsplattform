import { describe, expect, it } from "vitest";
import { isValidSlug, parseHost } from "./hosts";

describe("parseHost", () => {
  const base = "vereine.example.at";
  it("recognises root, admin and club hosts", () => {
    expect(parseHost("vereine.example.at", base)).toEqual({ kind: "root" });
    expect(parseHost("ADMIN.vereine.example.at", base)).toEqual({ kind: "admin" });
    expect(parseHost("musikverein.vereine.example.at", base)).toEqual({ kind: "club", slug: "musikverein" });
  });
  it("rejects foreign, nested and reserved hosts", () => {
    expect(parseHost("evil.com", base)).toEqual({ kind: "unknown" });
    expect(parseHost("a.b.vereine.example.at", base)).toEqual({ kind: "unknown" });
    expect(parseHost("www.vereine.example.at", base)).toEqual({ kind: "unknown" });
    expect(parseHost("xvereine.example.at", base)).toEqual({ kind: "unknown" });
    expect(parseHost(null, base)).toEqual({ kind: "unknown" });
  });
  it("works with a port in the base domain (development)", () => {
    expect(parseHost("sv.localhost:3000", "localhost:3000")).toEqual({ kind: "club", slug: "sv" });
    expect(parseHost("localhost:3000", "localhost:3000")).toEqual({ kind: "root" });
  });
  it("validates slugs", () => {
    expect(isValidSlug("sv-gruenbach")).toBe(true);
    expect(isValidSlug("-x")).toBe(false);
    expect(isValidSlug("admin")).toBe(false);
    expect(isValidSlug("Groß")).toBe(false);
  });
});

import { requestHost } from "./hosts";

describe("requestHost", () => {
  const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });
  it("prefers the forwarded host (internal re-render after a Server Action)", () => {
    expect(requestHost(h({ host: "localhost:3000", "x-forwarded-host": "sv.example.at" }))).toBe("sv.example.at");
    expect(requestHost(h({ "x-forwarded-host": "a.example.at, proxy" }))).toBe("a.example.at");
    expect(requestHost(h({ host: "sv.example.at" }))).toBe("sv.example.at");
  });
});
