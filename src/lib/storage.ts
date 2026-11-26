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

const SIGNATURES: Record<string, (b: Uint8Array) => boolean> = {
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) => String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  ico: (b) => b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0,
};

/** Detects the real image type from the file's bytes (the browser-supplied type is not trusted). */
export function sniffImage(bytes: Uint8Array): keyof typeof SIGNATURES | null {
  for (const [type, test] of Object.entries(SIGNATURES)) if (test(bytes)) return type as keyof typeof SIGNATURES;
  return null;
}

/** Stores an uploaded image after checking its real type and size; returns the storage name. */
export async function storeImage(file: File, allowed: string[], maxBytes: number) {
  if (file.size > maxBytes) throw new UploadError(`Die Datei ist größer als ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type || !allowed.includes(type)) throw new UploadError(`Erlaubt sind ${allowed.map((t) => t.toUpperCase()).join(", ")}.`);
  await mkdir(ROOT, { recursive: true });
  const storageName = `${randomToken(18)}.${type}`;
  await writeFile(resolveSafe(storageName), bytes);
  return storageName;
}

export class UploadError extends Error {
  name = "UploadError";
}
