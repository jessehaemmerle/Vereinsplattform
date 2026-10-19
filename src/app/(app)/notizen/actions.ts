"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { guarded, writer } from "@/lib/guard";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { flash } from "@/lib/flash";

const schema = z.object({ title: zf.text("Titel", 120), content: zf.text("Inhalt", 50_000), pinned: zf.checkbox() });

export async function saveNote(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("notes:write", "NOTIZEN");
    const parsed = schema.safeParse({ pinned: "false", ...formObject(formData) });
    if (!parsed.success) return fromZod(parsed.error);
    if (id) {
      const { count } = await db.note.updateMany({ where: { id, clubId: user.clubId }, data: parsed.data });
      if (!count) return { error: "Notiz nicht gefunden." };
    } else await db.note.create({ data: { ...parsed.data, clubId: user.clubId } });
  } catch (e) {
    return handleError(e);
  }
  await flash("Notiz gespeichert.");
  revalidatePath("/notizen");
  redirect("/notizen");
}

export async function deleteNote(formData: FormData) {
  await guarded(async () => {
    const user = await writer("notes:write", "NOTIZEN");
    await db.note.deleteMany({ where: { id: String(formData.get("id")), clubId: user.clubId } });
    await flash("Notiz gelöscht.");
  });
  revalidatePath("/notizen");
  redirect("/notizen");
}
