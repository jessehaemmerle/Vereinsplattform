import type { Module } from "@prisma/client";

export const MODULE_LABELS: Record<Module, string> = {
  MITGLIEDER: "Mitglieder",
  FINANZEN: "Finanzen",
  EVENTS: "Termine",
  NOTIZEN: "Notizen",
  DOKUMENTE: "Dokumente",
  KOMMUNIKATION: "Nachrichten",
};
