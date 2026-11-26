import "server-only";
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { safe } from "@/lib/pdf";
import { computeTotals, epcPayload, taxNote } from "@/lib/invoice-calc";
import { formatDate, formatEur } from "@/lib/format";
import { readStoredFile, sniffImage } from "@/lib/storage";
import type { InvoiceWithItems, IssuerSnapshot } from "@/lib/invoices";
import { platformName } from "@/lib/platform";

const A4: [number, number] = [595.28, 841.89];
const M = 56; // margin
const INK = rgb(0.11, 0.13, 0.12);
const MUTED = rgb(0.4, 0.44, 0.42);
const LINE = rgb(0.84, 0.86, 0.84);

function color(hex: string | null) {
  const m = hex?.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255) : rgb(0.18, 0.35, 0.27);
}

/** Splits text into lines that fit `width`. */
function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  for (const paragraph of safe(text).split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines;
}

const qty = (n: number) => (Number.isInteger(n) ? String(n) : n.toLocaleString("de-AT", { maximumFractionDigits: 3 }));

export async function renderInvoicePdf(invoice: InvoiceWithItems, issuerDraft: IssuerSnapshot) {
  const issuer = (invoice.issuerSnapshot as IssuerSnapshot | null) ?? issuerDraft;
  const doc = await PDFDocument.create();
  const title = invoice.kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung";
  doc.setTitle(invoice.number ? `${title} ${invoice.number}` : `${title} (Entwurf)`);
  doc.setAuthor(issuer.name);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const accent = color(issuer.color);
  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - M;
  const text = (t: string, x: number, yy: number, size = 10, f: PDFFont = font, c = INK) => page.drawText(safe(t), { x, y: yy, size, font: f, color: c });
  const right = (t: string, xr: number, yy: number, size = 10, f: PDFFont = font, c = INK) => text(t, xr - f.widthOfTextAtSize(safe(t), size), yy, size, f, c);

  // header: logo + issuer block on the right
  page.drawRectangle({ x: 0, y: A4[1] - 6, width: A4[0], height: 6, color: accent });
  let headerBottom = y;
  if (issuer.logoPath) {
    const bytes = await readStoredFile(issuer.logoPath).catch(() => null);
    const type = bytes ? sniffImage(bytes) : null;
    if (bytes && (type === "png" || type === "jpg")) {
      try {
        const img = type === "png" ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
        const s = Math.min(120 / img.width, 48 / img.height);
        page.drawImage(img, { x: A4[0] - M - img.width * s, y: y - img.height * s, width: img.width * s, height: img.height * s });
        headerBottom = y - img.height * s - 12;
      } catch {
        // a broken logo must never break an invoice
      }
    }
  }
  let hy = headerBottom;
  right(issuer.name, A4[0] - M, hy - 10, 10, bold);
  hy -= 24;
  for (const l of [...issuer.addressLines, issuer.email, issuer.phone].filter(Boolean) as string[]) {
    right(l, A4[0] - M, hy, 9, font, MUTED);
    hy -= 12;
  }

  // address window (left, DIN 5008 position)
  y = A4[1] - 160;
  text([issuer.name, ...issuer.addressLines].join(" · "), M, y + 14, 7, font, MUTED);
  page.drawLine({ start: { x: M, y: y + 10 }, end: { x: M + 240, y: y + 10 }, thickness: 0.4, color: LINE });
  for (const l of [invoice.recipientName, ...(invoice.recipientAddress ?? "").split(/\r?\n/)].filter((l) => l.trim())) {
    text(l, M, y - 4, 11);
    y -= 15;
  }
  if (invoice.recipientVatId) text(`UID: ${invoice.recipientVatId}`, M, y - 4, 9, font, MUTED);

  // title + facts
  y = Math.min(y - 30, hy - 20, A4[1] - 290);
  text(invoice.number ? `${title} ${invoice.number}` : `${title} – Entwurf`, M, y, 18, bold);
  y -= 24;
  const facts: [string, string][] = [
    ["Rechnungsdatum", invoice.issueDate ? formatDate(invoice.issueDate) : "wird beim Ausstellen gesetzt"],
    ...(invoice.servicePeriod ? ([["Leistungszeitraum", invoice.servicePeriod]] as [string, string][]) : []),
    ...(invoice.kind === "INVOICE" && invoice.dueDate ? ([["Zahlbar bis", formatDate(invoice.dueDate)]] as [string, string][]) : []),
    ...(issuer.vatId ? ([["Unsere UID", issuer.vatId]] as [string, string][]) : []),
  ];
  for (const [k, v] of facts) {
    text(k, M, y, 9, font, MUTED);
    text(v, M + 110, y, 9);
    y -= 13;
  }
  y -= 8;
  if (invoice.intro) {
    for (const l of wrap(invoice.intro, font, 10, A4[0] - 2 * M)) {
      text(l, M, y);
      y -= 14;
    }
    y -= 6;
  }

  // items
  const taxable = invoice.taxMode === "STEUERPFLICHTIG";
  const cols = taxable
    ? { pos: M, desc: M + 26, qty: 340, unit: 385, price: 470, tax: 500, total: A4[0] - M }
    : { pos: M, desc: M + 26, qty: 370, unit: 415, price: 495, tax: 0, total: A4[0] - M };
  const descWidth = cols.qty - 40 - cols.desc;
  const header = () => {
    page.drawRectangle({ x: M, y: y - 5, width: A4[0] - 2 * M, height: 18, color: rgb(0.95, 0.96, 0.95) });
    text("Pos.", cols.pos + 2, y, 8, bold, MUTED);
    text("Beschreibung", cols.desc, y, 8, bold, MUTED);
    right("Menge", cols.qty, y, 8, bold, MUTED);
    text("Einheit", cols.qty + 8, y, 8, bold, MUTED);
    right(taxable ? "Einzel netto" : "Einzelpreis", cols.price, y, 8, bold, MUTED);
    if (taxable) right("USt", cols.tax + 22, y, 8, bold, MUTED);
    right("Betrag", cols.total, y, 8, bold, MUTED);
    y -= 20;
  };
  header();
  const totals = computeTotals(
    invoice.items.map((i) => ({ quantity: Number(i.quantity), unitCents: i.unitCents, taxRate: i.taxRate })),
    invoice.taxMode,
  );
  invoice.items
    .sort((a, b) => a.position - b.position)
    .forEach((item, idx) => {
      const lines = wrap(item.description, font, 9.5, descWidth);
      if (y - lines.length * 12 < 170) {
        page = doc.addPage(A4);
        y = A4[1] - M;
        header();
      }
      text(String(idx + 1), cols.pos + 2, y, 9.5);
      lines.forEach((l, i) => text(l, cols.desc, y - i * 12, 9.5));
      right(qty(Number(item.quantity)), cols.qty, y, 9.5);
      text(item.unit ?? "", cols.qty + 8, y, 9.5);
      right(formatEur(item.unitCents / 100), cols.price, y, 9.5);
      if (taxable) right(`${item.taxRate} %`, cols.tax + 22, y, 9.5);
      right(formatEur(totals.lines[idx] / 100), cols.total, y, 9.5);
      y -= Math.max(1, lines.length) * 12 + 6;
      page.drawLine({ start: { x: M, y: y + 9 }, end: { x: A4[0] - M, y: y + 9 }, thickness: 0.3, color: LINE });
    });

  // totals
  y -= 6;
  const sumRow = (label: string, value: number, strong = false) => {
    right(label, 470, y, strong ? 11 : 9.5, strong ? bold : font, strong ? INK : MUTED);
    right(formatEur(value / 100), A4[0] - M, y, strong ? 11 : 9.5, strong ? bold : font);
    y -= strong ? 18 : 14;
  };
  if (taxable) {
    sumRow("Summe netto", totals.netCents);
    for (const g of totals.groups) sumRow(`USt ${g.rate} % auf ${formatEur(g.netCents / 100)}`, g.taxCents);
  }
  page.drawLine({ start: { x: 330, y: y + 10 }, end: { x: A4[0] - M, y: y + 10 }, thickness: 0.8, color: accent });
  y -= 2;
  sumRow(invoice.kind === "CANCELLATION" ? "Gutschrift gesamt" : "Gesamtbetrag", totals.grossCents, true);
  const note = taxNote(invoice.taxMode);
  if (note) {
    text(note, M, y, 8.5, font, MUTED);
    y -= 14;
  }

  // payment with EPC QR code
  y -= 10;
  if (invoice.kind === "INVOICE" && totals.grossCents > 0 && issuer.iban) {
    const reference = invoice.number ?? "Entwurf";
    const payload = epcPayload({ name: issuer.name, iban: issuer.iban, bic: issuer.bic, amountCents: totals.grossCents, text: reference });
    const lines = [
      `Bitte überweise ${formatEur(totals.grossCents / 100)}${invoice.dueDate ? ` bis ${formatDate(invoice.dueDate)}` : ""} auf folgendes Konto:`,
      `${issuer.name}`,
      `IBAN ${issuer.iban.replace(/(.{4})/g, "$1 ").trim()}${issuer.bic ? ` · BIC ${issuer.bic}` : ""}`,
      ...(issuer.bankName ? [issuer.bankName] : []),
      `Verwendungszweck: ${reference}`,
    ];
    if (y < 150) {
      page = doc.addPage(A4);
      y = A4[1] - M;
    }
    lines.forEach((l, i) => text(l, M, y - i * 13, 9.5, i === 0 ? bold : font));
    if (payload) {
      const png = await QRCode.toBuffer(payload, { errorCorrectionLevel: "M", margin: 1, width: 240 });
      const img = await doc.embedPng(png);
      page.drawImage(img, { x: A4[0] - M - 86, y: y - 78, width: 86, height: 86 });
      right("Zahlen mit Code", A4[0] - M, y - 90, 7, font, MUTED);
    }
    y -= lines.length * 13 + 30;
  } else if (invoice.kind === "CANCELLATION") {
    text("Bereits bezahlte Beträge werden erstattet bzw. verrechnet.", M, y, 9.5);
    y -= 20;
  }
  if (invoice.notes) {
    for (const l of wrap(invoice.notes, font, 9.5, A4[0] - 2 * M - 100)) {
      text(l, M, y, 9.5);
      y -= 13;
    }
  }

  // footer and draft watermark on every page
  const pages = doc.getPages();
  const footerParts = [issuer.name, issuer.addressLines.join(", "), issuer.vatId ? `UID ${issuer.vatId}` : null, issuer.register, issuer.email].filter(
    Boolean,
  ) as string[];
  pages.forEach((p, i) => {
    page = p;
    p.drawLine({ start: { x: M, y: 52 }, end: { x: A4[0] - M, y: 52 }, thickness: 0.4, color: LINE });
    wrap(footerParts.join(" · "), font, 7, A4[0] - 2 * M - 60).forEach((l, j) => text(l, M, 40 - j * 9, 7, font, MUTED));
    if (issuer.footer) wrap(issuer.footer, font, 7, A4[0] - 2 * M - 60).forEach((l, j) => text(l, M, 22 - j * 9, 7, font, MUTED));
    right(`Seite ${i + 1}/${pages.length}`, A4[0] - M, 40, 7, font, MUTED);
    right(`erstellt mit ${platformName()}`, A4[0] - M, 31, 6, font, MUTED);
    if (!invoice.number) {
      p.drawText("ENTWURF", { x: 120, y: 300, size: 110, font: bold, color: rgb(0.85, 0.2, 0.15), opacity: 0.12, rotate: degrees(35) });
    }
  });
  return doc.save();
}
