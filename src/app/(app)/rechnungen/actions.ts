"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { guarded, writer } from "@/lib/guard";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { billingSchema, parseInvoiceForm } from "@/lib/invoice-input";
import { saveDraft } from "@/lib/invoices";
import { INVOICE_OPS, runInvoiceOp } from "@/lib/invoice-ops";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";

async function clubIssuer() {
  const user = await writer("invoices:write", "FINANZEN");
  return { user, issuer: { kind: "club" as const, club: user.club } };
}

export async function saveClubInvoice(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  let invoiceId = id;
  try {
    const { user, issuer } = await clubIssuer();
    const parsed = parseInvoiceForm(formData);
    if (!parsed.success) return fromZod(parsed.error);
    // recipient references must belong to this club
    const contactId = String(formData.get("recipientContactId") ?? "") || null;
    const memberId = String(formData.get("recipientMemberId") ?? "") || null;
    const contact = contactId ? await db.contact.findFirst({ where: { id: contactId, clubId: user.clubId } }) : null;
    const member = memberId ? await db.member.findFirst({ where: { id: memberId, clubId: user.clubId } }) : null;
    let recipientContactId = contact?.id ?? null;
    if (!contact && !member && formData.get("saveContact") === "on") {
      const created = await db.contact.create({
        data: {
          clubId: user.clubId,
          name: parsed.data.recipientName,
          address: parsed.data.recipientAddress,
          email: parsed.data.recipientEmail,
          vatId: parsed.data.recipientVatId,
        },
      });
      recipientContactId = created.id;
    }
    const saved = await saveDraft(issuer, { ...parsed.data, recipientContactId, recipientMemberId: member?.id ?? null }, id ?? undefined);
    invoiceId = saved.id;
    if (!id) await logActivity({ clubId: user.clubId, userId: user.id, action: "invoice_drafted", detail: parsed.data.recipientName });
  } catch (e) {
    return handleError(e);
  }
  await flash("Entwurf gespeichert.");
  revalidatePath("/rechnungen");
  redirect(`/rechnungen/${invoiceId}`);
}

export async function clubInvoiceAction(formData: FormData) {
  const id = String(formData.get("id"));
  let deleted = false;
  await guarded(async () => {
    const { user, issuer } = await clubIssuer();
    const op = z.enum(INVOICE_OPS).safeParse(formData.get("op"));
    if (!op.success) return;
    const result = await runInvoiceOp(issuer, op.data, id, String(formData.get("paidOn") ?? ""));
    deleted = !!result.deleted;
    if (result.ok) await logActivity({ clubId: user.clubId, userId: user.id, action: `invoice_${op.data}`, detail: result.ok });
    await flash(result.ok ?? result.error ?? "", result.error ? "error" : "success");
  });
  revalidatePath("/rechnungen");
  revalidatePath("/finanzen");
  redirect(deleted ? "/rechnungen" : `/rechnungen/${id}`);
}

const contactSchema = z.object({
  name: zf.text("Name", 200),
  address: zf.optText(500),
  email: z.preprocess((v) => (v === "" || v === undefined ? null : v), zf.email().nullable()),
  vatId: zf.optText(30),
  notes: zf.optText(1000),
});

export async function saveContact(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  try {
    const { user } = await clubIssuer();
    const parsed = contactSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    if (id) {
      const { count } = await db.contact.updateMany({ where: { id, clubId: user.clubId }, data: parsed.data });
      if (!count) return { error: "Kontakt nicht gefunden." };
    } else await db.contact.create({ data: { ...parsed.data, clubId: user.clubId } });
  } catch (e) {
    return handleError(e);
  }
  await flash("Kontakt gespeichert.");
  revalidatePath("/rechnungen/kontakte");
  redirect("/rechnungen/kontakte");
}

export async function deleteContact(formData: FormData) {
  await guarded(async () => {
    const { user } = await clubIssuer();
    // issued invoices keep their recipient snapshot, so deleting the address is safe
    await db.contact.deleteMany({ where: { id: String(formData.get("id")), clubId: user.clubId } });
    await flash("Kontakt gelöscht.");
  });
  redirect("/rechnungen/kontakte");
}

export async function saveClubBilling(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("club:manage", "FINANZEN");
    const parsed = billingSchema.extend({ vatId: zf.optText(30) }).safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    await db.club.update({ where: { id: user.clubId }, data: parsed.data });
    revalidatePath("/rechnungen");
    return { ok: "Rechnungseinstellungen gespeichert. Sie gelten für neu ausgestellte Rechnungen." };
  } catch (e) {
    return handleError(e);
  }
}
