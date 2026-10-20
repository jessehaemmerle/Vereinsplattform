"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { guarded, writer } from "@/lib/guard";
import { handleError, type FormState } from "@/lib/form";
import { deleteStoredFile, MAX_UPLOAD_BYTES, storeFile } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";

export async function uploadDocument(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("docs:write", "DOKUMENTE");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Bitte wähle eine Datei aus.", fieldErrors: { file: "Keine Datei gewählt" } };
    if (file.size > MAX_UPLOAD_BYTES) return { error: "Die Datei ist größer als 20 MB." };
    const storageName = await storeFile(file);
    const description =
      String(formData.get("description") ?? "")
        .trim()
        .slice(0, 500) || null;
    await db.document.create({
      data: {
        clubId: user.clubId,
        uploadedById: user.id,
        storageName,
        originalName: file.name.slice(0, 200),
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        description,
        visibleToMembers: formData.get("visibleToMembers") === "on",
      },
    });
    await logActivity({ clubId: user.clubId, userId: user.id, action: "document_uploaded", detail: file.name });
  } catch (e) {
    return handleError(e);
  }
  revalidatePath("/dokumente");
  return { ok: "Dokument hochgeladen." };
}

export async function deleteDocument(formData: FormData) {
  await guarded(async () => {
    const user = await writer("docs:write", "DOKUMENTE");
    const doc = await db.document.findFirst({ where: { id: String(formData.get("id")), clubId: user.clubId } });
    if (!doc) return;
    await db.document.delete({ where: { id: doc.id } });
    await deleteStoredFile(doc.storageName);
    await flash("Dokument gelöscht.");
  });
  revalidatePath("/dokumente");
  redirect("/dokumente");
}

export async function toggleDocumentVisibility(formData: FormData) {
  await guarded(async () => {
    const user = await writer("docs:write", "DOKUMENTE");
    const doc = await db.document.findFirst({ where: { id: String(formData.get("id")), clubId: user.clubId } });
    if (!doc) return;
    await db.document.update({ where: { id: doc.id }, data: { visibleToMembers: !doc.visibleToMembers } });
  });
  revalidatePath("/dokumente");
}
