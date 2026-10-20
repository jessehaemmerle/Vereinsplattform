"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type Flash = { message: string; kind: "success" | "error" | "info" };

/** Displays the one-shot message the server read from the flash cookie and clears that cookie. */
export function FlashToast({ flash: initial }: { flash: Flash }) {
  const [flash, setFlash] = useState<Flash | null>(initial);

  useEffect(() => {
    document.cookie = "vp_flash=; Max-Age=0; path=/";
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, []);

  if (!flash) return null;
  return (
    <div
      role="status"
      className={cn(
        "fixed right-4 bottom-4 z-50 flex max-w-sm items-start gap-3 rounded-md border px-4 py-3 text-sm shadow-lg",
        flash.kind === "error" ? "border-danger/40 bg-danger-soft text-danger" : "border-loden/30 bg-surface text-ink",
      )}
    >
      <span className="flex-1">{flash.message}</span>
      <button onClick={() => setFlash(null)} aria-label="Meldung schließen" className="text-muted hover:text-ink">
        <X className="size-4" />
      </button>
    </div>
  );
}
