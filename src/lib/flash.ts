import "server-only";
import { cookies } from "next/headers";

export type FlashKind = "success" | "error" | "info";

/** One-shot message shown after the next navigation (read and cleared on the client). */
export async function flash(message: string, kind: FlashKind = "success") {
  const jar = await cookies();
  jar.set("vp_flash", encodeURIComponent(JSON.stringify({ message, kind })), { path: "/", maxAge: 30, sameSite: "lax" });
}

export async function readFlash(): Promise<{ raw: string; message: string; kind: FlashKind } | null> {
  const raw = (await cookies()).get("vp_flash")?.value;
  if (!raw) return null;
  try {
    let decoded = raw;
    for (let i = 0; i < 2 && decoded.startsWith("%"); i++) decoded = decodeURIComponent(decoded);
    return { raw, ...JSON.parse(decoded) };
  } catch {
    return null;
  }
}
