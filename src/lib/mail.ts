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

export type Mail = { to: string; subject: string; text: string; replyTo?: string | null };

export async function sendMail(mail: Mail) {
  if (!mailConfigured()) {
    console.warn(`[mail] SMTP nicht konfiguriert – E-Mail an ${mail.to} nicht gesendet: ${mail.subject}\n${mail.text}`);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM ?? "Vereinsplattform <noreply@localhost>",
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    html: textToHtml(mail.text),
    replyTo: mail.replyTo ?? undefined,
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

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function textToHtml(text: string) {
  const body = escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1d2621;max-width:600px">${body}</div>`;
}

/** Replaces {{vorname}}, {{nachname}}, {{verein}} … placeholders. */
export function fillPlaceholders(template: string, values: Record<string, string>) {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => values[key.toLowerCase()] ?? match);
}
