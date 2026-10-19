"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireClubUser } from "@/lib/auth";
import { assertLicensed } from "@/lib/license";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { logActivity } from "@/lib/activity";

const schema = z.object({ phone: zf.optText(50), street: zf.optText(200), zip: zf.optText(20), city: zf.optText(120) });

export async function updateOwnContact(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireClubUser();
    if (!user.member) return { error: "Mit deinem Zugang ist kein Mitglied verknüpft." };
    await assertLicensed(user.clubId);
    const parsed = schema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    await db.member.update({ where: { id: user.member.id }, data: parsed.data });
    await logActivity({ clubId: user.clubId, userId: user.id, action: "member_updated", detail: "eigene Kontaktdaten" });
    revalidatePath("/mein-bereich");
    return { ok: "Deine Daten sind gespeichert." };
  } catch (e) {
    return handleError(e);
  }
}
