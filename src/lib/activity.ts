import "server-only";
import { db } from "@/lib/db";

export async function logActivity(entry: { clubId?: string | null; userId?: string | null; action: string; detail?: string }) {
  try {
    await db.activity.create({ data: { clubId: entry.clubId ?? null, userId: entry.userId ?? null, action: entry.action, detail: entry.detail } });
  } catch (error) {
    console.error("[activity] konnte nicht gespeichert werden", error);
  }
}
