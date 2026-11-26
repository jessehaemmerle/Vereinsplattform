import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { fromHeader, renderHtml } = await import("./mail");

const brand = {
  name: "SV <Grün>",
  senderName: 'SV "Grün"\r\nBcc: x',
  color: "#123456",
  logoUrl: "https://sv.example.at/api/branding/logo?v=1",
  footer: "Vereinsweg 1",
  replyTo: null,
};

describe("branded mail", () => {
  it("uses the club name with the platform address and strips header injection", () => {
    process.env.SMTP_FROM = "Vereinsplattform <noreply@plattform.at>";
    expect(fromHeader(brand)).toBe('"SV GrünBcc: x" <noreply@plattform.at>');
    expect(fromHeader(null)).toBe("Vereinsplattform <noreply@plattform.at>");
  });
  it("escapes club-controlled text and shows the platform hint", () => {
    const html = renderHtml("Hallo <b>\nhttps://x.at/a", brand);
    expect(html).toContain("SV &lt;Grün&gt;");
    expect(html).toContain("background:#123456");
    expect(html).toContain("Hallo &lt;b&gt;");
    expect(html).toContain("powered by Vereinsplattform");
  });
  it("ignores an invalid colour", () => {
    expect(renderHtml("x", { ...brand, color: "red;background:url(x)" })).toContain("background:#2e5a44");
  });
});
