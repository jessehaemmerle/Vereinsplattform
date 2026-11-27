"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { formObject, fromZod, handleError, type FormState } from "@/lib/form";
import { billingSchema, parseInvoiceForm } from "@/lib/invoice-input";
import { InvoiceError, platformIssuer, saveDraft } from "@/lib/invoices";
import { describeRun, generateLicenseInvoices, RUN_MODES } from "@/lib/billing";
import { INVOICE_OPS, runInvoiceOp } from "@/lib/invoice-ops";
import { flash } from "@/lib/flash";

export async function savePlatformInvoice(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  let invoiceId = id;
  try {
    await requirePlatformAdmin();
    const parsed = parseInvoiceForm(formData);
    if (!parsed.success) return fromZod(parsed.error);
    const clubId = String(formData.get("recipientClubId") ?? "") || null;
    const club = clubId ? await db.club.findUnique({ where: { id: clubId }, select: { id: true } }) : null;
    const saved = await saveDraft(await platformIssuer(), { ...parsed.data, recipientClubId: club?.id ?? null }, id ?? undefined);
    invoiceId = saved.id;
  } catch (e) {
    return handleError(e);
  }
  await flash("Entwurf gespeichert.");
  revalidatePath("/admin/rechnungen");
  redirect(`/admin/rechnungen/${invoiceId}`);
}

export async function platformInvoiceAction(formData: FormData) {
  await requirePlatformAdmin();
  const op = z.enum(INVOICE_OPS).safeParse(formData.get("op"));
  const id = String(formData.get("id"));
  if (!op.success) redirect("/admin/rechnungen");
  const result = await runInvoiceOp(await platformIssuer(), op.data, id, String(formData.get("paidOn") ?? ""));
  await flash(result.ok ?? result.error ?? "", result.error ? "error" : "success");
  revalidatePath("/admin/rechnungen");
  redirect(result.deleted ? "/admin/rechnungen" : `/admin/rechnungen/${id}`);
}

export async function savePlatformBilling(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await requirePlatformAdmin();
    const parsed = billingSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    await db.platformSettings.upsert({ where: { id: "default" }, create: { id: "default", ...parsed.data }, update: parsed.data });
    revalidatePath("/admin/rechnungen");
    return { ok: "Rechnungseinstellungen gespeichert. Sie gelten für neu ausgestellte Rechnungen." };
  } catch (e) {
    return handleError(e);
  }
}

/** Billing run: subscription invoices for the selected licenses (or the single one of a row button). */
export async function runLicenseBilling(formData: FormData) {
  await requirePlatformAdmin();
  const mode = z.enum(RUN_MODES).catch("draft").parse(formData.get("mode"));
  const only = String(formData.get("only") ?? "");
  const ids = only ? [only] : formData.getAll("ids").map(String);
  try {
    const result = await generateLicenseInvoices(ids, mode);
    await flash(describeRun(result, "Rechnungen"), result.mailFailed ? "error" : "success");
  } catch (e) {
    if (!(e instanceof InvoiceError)) throw e;
    await flash(e.message, "error");
  }
  revalidatePath("/admin/abrechnung");
  revalidatePath("/admin/rechnungen");
  redirect("/admin/abrechnung");
}
