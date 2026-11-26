import type { ReactNode } from "react";
import { getPlatformSettings, missingFields } from "@/lib/legal";

/** Shared frame for legal texts: readable measure, visible warning while operator data is incomplete. */
export async function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const missing = missingFields(await getPlatformSettings());
  return (
    <article className="legal">
      <h1 className="text-[36px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="text-muted mt-2 text-sm">Stand: {updated}</p>
      {missing.length > 0 && (
        <p role="note" className="border-brass/40 bg-brass-soft mt-6 rounded-md border px-4 py-3 text-sm">
          Diese Seite ist noch nicht vollständig: Angaben in eckigen Klammern werden vom Betreiber vor dem Start ergänzt.
        </p>
      )}
      <div className="[&_a]:text-loden [&_dt]:text-muted mt-10 space-y-4 leading-relaxed [&_a]:underline-offset-4 hover:[&_a]:underline [&_dd]:mb-3 [&_dt]:text-sm [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </article>
  );
}

export function Address({ lines }: { lines: (string | null | undefined)[] }) {
  return (
    <p>
      {lines.filter(Boolean).map((l, i) => (
        <span key={i} className="block">
          {l}
        </span>
      ))}
    </p>
  );
}
