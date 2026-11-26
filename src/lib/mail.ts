import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { platformName } from "@/lib/platform";

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

export type Mail = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string | null;
  brand?: MailBrand | null;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
};

const PLATFORM_NAME = platformName();

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
    // the body may contain password links – only print it during local development
    const body = process.env.NODE_ENV === "production" ? "" : `\n${mail.text}`;
    console.warn(`[mail] SMTP nicht konfiguriert – E-Mail an ${mail.to} nicht gesendet: ${mail.subject}${body}`);
    return;
  }
  await getTransporter().sendMail({
    from: fromHeader(mail.brand),
    to: mail.to,
    subject: mail.subject,
    text: mail.brand?.footer ? `${mail.text}\n\n--\n${mail.brand.footer}` : mail.text,
    html: renderHtml(mail.text, mail.brand),
    replyTo: mail.replyTo ?? mail.brand?.replyTo ?? undefined,
    attachments: mail.attachments,
  });
}

/**
 * Sends and reports failure instead of throwing – for mails that follow a change already saved
 * (a broken mail server must not make a successful action look failed).
 */
export async function trySendMail(mail: Mail): Promise<boolean> {
  try {
    await sendMail(mail);
    return true;
  } catch (error) {
    console.error(`[mail] Versand an ${mail.to} fehlgeschlagen`, error);
    return false;
  }
}

/** Plain-language reason for a mail server error (shown to platform admins when testing the setup). */
export function describeMailError(error: unknown) {
  const e = error as { code?: string; responseCode?: number; message?: string };
  // nodemailer often wraps the network error as ESOCKET and keeps the original code only in the message
  const has = (code: string) => e.code === code || (e.message ?? "").includes(code);
  if (has("ECONNREFUSED")) return "Der Mailserver lehnt die Verbindung ab – stimmen SMTP_HOST und SMTP_PORT?";
  if (has("ENOTFOUND") || has("EAI_AGAIN") || e.code === "EDNS") return "Der Mailserver wurde nicht gefunden – SMTP_HOST prüfen.";
  if (has("ETIMEDOUT") || e.code === "ESOCKET") return "Keine Antwort vom Mailserver – Port, SMTP_SECURE oder Firewall prüfen.";
  if (e.code === "EAUTH" || e.responseCode === 535) return "Anmeldung am Mailserver fehlgeschlagen – SMTP_USER und SMTP_PASSWORD prüfen.";
  if (e.responseCode === 550 || e.responseCode === 553) return "Der Mailserver akzeptiert die Absenderadresse nicht – SMTP_FROM prüfen.";
  return e.message ?? String(error);
}

export async function verifyMailSetup() {
  if (!mailConfigured()) return { ok: false, message: "SMTP_HOST ist nicht gesetzt – E-Mails werden nur ins Server-Log geschrieben." };
  try {
    await getTransporter().verify();
    return { ok: true, message: "Verbindung zum Mailserver funktioniert." };
  } catch (error) {
    return { ok: false, message: describeMailError(error) };
  }
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
