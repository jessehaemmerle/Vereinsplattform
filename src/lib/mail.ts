import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "localhost",
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

export function mailConfigured() {
  return !!process.env.SMTP_HOST;
}

/** Per-club look of outgoing mail (white label). */
export type MailBrand = { name: string; senderName: string; color: string; logoUrl: string | null; footer: string | null; replyTo: string | null };

export type Mail = { to: string; subject: string; text: string; replyTo?: string | null; brand?: MailBrand | null };

const PLATFORM_NAME = "Vereinsplattform";

/** From header: the club's sender name with the platform's verified address (keeps SPF/DKIM intact). */
export function fromHeader(brand?: MailBrand | null) {
  const configured = process.env.SMTP_FROM ?? `${PLATFORM_NAME} <noreply@localhost>`;
  if (!brand) return configured;
  const address = configured.match(/<([^>]+)>/)?.[1] ?? configured.trim();
  const name = brand.senderName.replace(/["\\\r\n<>]/g, "").slice(0, 80);
  return `"${name}" <${address}>`;
}

export async function sendMail(mail: Mail) {
  if (!mailConfigured()) {
    console.warn(`[mail] SMTP nicht konfiguriert – E-Mail an ${mail.to} nicht gesendet: ${mail.subject}\n${mail.text}`);
    return;
  }
  await getTransporter().sendMail({
    from: fromHeader(mail.brand),
    to: mail.to,
    subject: mail.subject,
    text: mail.brand?.footer ? `${mail.text}\n\n--\n${mail.brand.footer}` : mail.text,
    html: renderHtml(mail.text, mail.brand),
    replyTo: mail.replyTo ?? mail.brand?.replyTo ?? undefined,
  });
}

/** Sends one mail per recipient so addresses are never disclosed to each other. */
export async function sendBulk(mails: Mail[]) {
  let failed = 0;
  for (const mail of mails) {
    try {
      await sendMail(mail);
    } catch (error) {
      failed++;
      console.error(`[mail] Versand an ${mail.to} fehlgeschlagen`, error);
    }
  }
  return { sent: mails.length - failed, failed };
}

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function paragraphs(text: string) {
  return escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:inherit">$1</a>')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function renderHtml(text: string, brand?: MailBrand | null) {
  const color = brand && /^#[0-9a-f]{6}$/i.test(brand.color) ? brand.color : "#2e5a44";
  const header = brand
    ? `<tr><td style="background:${color};padding:18px 28px;color:#fff;font-size:18px;font-weight:600">${
        brand.logoUrl
          ? `<img src="${escapeHtml(brand.logoUrl)}" alt="" height="36" style="height:36px;vertical-align:middle;margin-right:12px;background:#fff;border-radius:4px;padding:2px">`
          : ""
      }${escapeHtml(brand.name)}</td></tr>`
    : "";
  const footer = `<tr><td style="padding:16px 28px;color:#6b756f;font-size:12px;border-top:1px solid #e3e7e2">${
    brand?.footer ? `${escapeHtml(brand.footer).replace(/\n/g, "<br>")}<br><br>` : ""
  }<span style="opacity:.7">powered by ${PLATFORM_NAME}</span></td></tr>`;
  return `<!doctype html><html><body style="margin:0;background:#f4f6f2;padding:24px 12px;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e3e7e2">
${header}<tr><td style="padding:24px 28px;font-size:15px;line-height:1.55;color:#1d2621">${paragraphs(text)}</td></tr>${footer}</table></body></html>`;
}

/** Replaces {{vorname}}, {{nachname}}, {{verein}} … placeholders. */
export function fillPlaceholders(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => values[key.toLowerCase()] ?? match);
}
