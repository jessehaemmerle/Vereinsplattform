import type { Role } from "@prisma/client";

export const PERMISSIONS = [
  "members:read",
  "members:write",
  "fees:write",
  "finance:read",
  "finance:write",
  "events:read",
  "events:write",
  "notes:read",
  "notes:write",
  "docs:read",
  "docs:write",
  "mail:send",
  "club:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const READ_ALL: Permission[] = ["members:read", "finance:read", "events:read", "notes:read", "docs:read"];

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [...PERMISSIONS],
  KASSIER: [...READ_ALL, "finance:write", "fees:write"],
  SCHRIFTFUEHRER: [...READ_ALL, "members:write", "events:write", "notes:write", "docs:write", "mail:send"],
  VORSTAND: READ_ALL,
  MITGLIED: [],
};

export function can(role: Role, permission: Permission) {
  return MATRIX[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Vereins-Admin",
  KASSIER: "Kassier",
  SCHRIFTFUEHRER: "Schriftführer",
  VORSTAND: "Vorstand",
  MITGLIED: "Mitglied",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Darf alles, auch Benutzer und Vereinsdaten verwalten",
  KASSIER: "Verwaltet Finanzen und Mitgliedsbeiträge, sieht alles andere",
  SCHRIFTFUEHRER: "Verwaltet Mitglieder, Events, Notizen, Dokumente und Nachrichten",
  VORSTAND: "Sieht alle Bereiche, ändert nichts",
  MITGLIED: "Nur der eigene Mitgliederbereich",
};
