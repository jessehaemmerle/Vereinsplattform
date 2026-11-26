"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { formObject, fromZod, zf, type FormState } from "@/lib/form";
import { checkFormToken } from "@/lib/form-token";
import { rateLimit } from "@/lib/rate-limit";
import { getPlatformSettings } from "@/lib/legal";
import { sendMail } from "@/lib/mail";
import { adminUrl } from "@/lib/hosts";
import { getTenant } from "@/lib/tenant";

const schema = z.object({
  clubName: zf.text("Vereinsname", 120),
  name: zf.text("Name", 100),
  email: zf.email(),
  phone: zf.optText(50),
  members: zf.optInt(),
  message: zf.optText(3000),
  planId: z.preprocess((v) => (v ? v : null), z.string().max(40).nullable()),
  consent: z.literal("on", { error: "Bitte bestätige, dass du die Datenschutzerklärung gelesen hast" }),
});

/** Public inquiry from the landing page. No cookies, no third-party captcha: honeypot + signed time-trap + rate limit. */
export async function submitInquiry(_: FormState, formData: FormData): Promise<FormState> {
  const ok = { ok: "Danke! Deine Anfrage ist angekommen – wir melden uns in den nächsten Tagen." };
  const tenant = await getTenant();
  if (tenant.kind !== "root") return { error: "Anfragen bitte über die Startseite senden." };
  // bots fill hidden fields and submit instantly; answer like a success so they learn nothing
  if (String(formData.get("website") ?? "") !== "" || !checkFormToken(String(formData.get("t") ?? ""))) return ok;
  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
  if (!rateLimit(`inquiry:${ip}`, 5, 60 * 60_000)) return { error: "Zu viele Anfragen von deiner Verbindung. Bitte versuche es später erneut." };

  const parsed = schema.safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const { consent: _consent, planId, ...data } = parsed.data;
  void _consent;
  const plan = planId ? await db.licensePlan.findFirst({ where: { id: planId, publicListed: true } }) : null;
  const request = await db.contactRequest.create({ data: { ...data, planId: plan?.id ?? null } });

  const settings = await getPlatformSettings();
  const recipients = settings.contactEmail
    ? [settings.contactEmail]
    : (await db.user.findMany({ where: { isPlatformAdmin: true }, select: { email: true } })).map((u) => u.email);
  for (const to of recipients) {
    await sendMail({
      to,
      subject: `Neue Anfrage: ${data.clubName}`,
      replyTo: data.email,
      text: [
        `Verein: ${data.clubName}`,
        `Kontakt: ${data.name} <${data.email}>${data.phone ? `, ${data.phone}` : ""}`,
        data.members ? `Mitglieder: ca. ${data.members}` : null,
        plan ? `Paket: ${plan.name}` : null,
        data.message ? `\n${data.message}` : null,
        `\n${adminUrl(`/admin/anfragen#${request.id}`)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    }).catch((e) => console.error("[inquiry]", e));
  }
  return ok;
}
