import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type Column = { header: string; width: number; align?: "left" | "right" };
export type Section = { title?: string; columns: Column[]; rows: string[][]; footer?: string[] };

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 48;
const INK = rgb(0.11, 0.15, 0.13);
const MUTED = rgb(0.42, 0.47, 0.44);
const ACCENT = rgb(0.18, 0.35, 0.27);

/** Removes characters the WinAnsi standard fonts cannot encode. */
function safe(text: string) {
  return text.replace(/[^\x20-\x7E -ÿ€–—„“”‚‘’…]/g, "?");
}

function truncate(text: string, font: PDFFont, size: number, width: number) {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "…", size) > width) t = t.slice(0, -1);
  return t + "…";
}

export async function renderReport(opts: { title: string; subtitle: string; summary?: [string, string][]; sections: Section[] }) {
  const doc = await PDFDocument.create();
  doc.setTitle(opts.title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - MARGIN;

  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - MARGIN;
  };
  const ensure = (h: number) => {
    if (y - h < MARGIN + 20) newPage();
  };

  page.drawText(safe(opts.title), { x: MARGIN, y: y - 20, size: 20, font: bold, color: INK });
  y -= 38;
  page.drawText(safe(opts.subtitle), { x: MARGIN, y, size: 10, font, color: MUTED });
  y -= 24;

  if (opts.summary?.length) {
    for (const [label, value] of opts.summary) {
      page.drawText(safe(label), { x: MARGIN, y, size: 11, font, color: INK });
      page.drawText(safe(value), { x: MARGIN + 220 - bold.widthOfTextAtSize(safe(value), 11), y, size: 11, font: bold, color: INK });
      y -= 16;
    }
    y -= 12;
  }

  for (const section of opts.sections) {
    ensure(60);
    if (section.title) {
      page.drawText(safe(section.title), { x: MARGIN, y, size: 13, font: bold, color: ACCENT });
      y -= 20;
    }
    const drawRow = (cells: string[], f: PDFFont, size: number) => {
      let x = MARGIN;
      section.columns.forEach((col, i) => {
        const text = truncate(cells[i] ?? "", f, size, col.width - 6);
        const tx = col.align === "right" ? x + col.width - 6 - f.widthOfTextAtSize(text, size) : x;
        page.drawText(text, { x: tx, y, size, font: f, color: INK });
        x += col.width;
      });
    };
    const drawHeader = () => {
      drawRow(
        section.columns.map((c) => c.header),
        bold,
        9,
      );
      y -= 5;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.8, color: ACCENT });
      y -= 13;
    };
    drawHeader();
    if (!section.rows.length) {
      page.drawText("Keine Einträge", { x: MARGIN, y, size: 9, font, color: MUTED });
      y -= 14;
    }
    for (const row of section.rows) {
      if (y < MARGIN + 30) {
        newPage();
        drawHeader();
      }
      drawRow(row, font, 9);
      y -= 14;
    }
    if (section.footer) {
      y += 4;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: A4[0] - MARGIN, y }, thickness: 0.5, color: MUTED });
      y -= 12;
      drawRow(section.footer, bold, 9);
      y -= 14;
    }
    y -= 16;
  }

  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const label = `Seite ${i + 1} von ${pages.length}`;
    p.drawText(label, { x: A4[0] - MARGIN - font.widthOfTextAtSize(label, 8), y: 24, size: 8, font, color: MUTED });
  });
  return doc.save();
}
