import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomToken } from "@/lib/crypto";

const ROOT = path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads");
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

function resolveSafe(name: string) {
  const full = path.resolve(ROOT, name);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Ungültiger Dateipfad");
  return full;
}

export async function storeFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Die Datei ist größer als 20 MB.");
  await mkdir(ROOT, { recursive: true });
  const ext = path
    .extname(file.name)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "")
    .slice(0, 10);
  const storageName = `${randomToken(18)}${ext}`;
  await writeFile(resolveSafe(storageName), Buffer.from(await file.arrayBuffer()));
  return storageName;
}

export async function readStoredFile(storageName: string) {
  return readFile(resolveSafe(storageName));
}

export async function deleteStoredFile(storageName: string) {
  await unlink(resolveSafe(storageName)).catch(() => undefined);
}
