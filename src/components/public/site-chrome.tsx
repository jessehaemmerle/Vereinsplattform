import Link from "next/link";
import { platformName } from "@/lib/platform";
import { getPlatformSettings } from "@/lib/legal";
import { rootUrl } from "@/lib/hosts";

/** Small round mark: concentric rings, the motif of the login pages. */
export function Mark({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="15" fill="currentColor" />
      <circle cx="16" cy="16" r="9.5" fill="none" stroke="var(--paper)" strokeWidth="2" />
      <circle cx="16" cy="16" r="4" fill="var(--paper)" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="border-line/70 bg-paper/90 sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <Link href={rootUrl("/")} className="text-loden flex items-center gap-2.5 font-semibold">
          <Mark />
          <span className="text-ink text-[17px]">{platformName()}</span>
        </Link>
        <nav aria-label="Seitennavigation" className="text-muted hidden items-center gap-7 text-[15px] md:flex">
          <a href={rootUrl("/#funktionen")} className="hover:text-ink">
            Funktionen
          </a>
          <a href={rootUrl("/#preise")} className="hover:text-ink">
            Preise
          </a>
          <a href={rootUrl("/#sicherheit")} className="hover:text-ink">
            Sicherheit
          </a>
          <a href={rootUrl("/#fragen")} className="hover:text-ink">
            Fragen
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <a href={rootUrl("/#anmelden")} className="text-ink hover:text-loden hidden px-3 text-[15px] sm:block">
            Anmelden
          </a>
          <a
            href={rootUrl("/#anfrage")}
            className="bg-loden hover:bg-loden-strong inline-flex h-9 items-center rounded-md px-4 text-[15px] font-medium text-white"
          >
            Zugang anfragen
          </a>
        </div>
      </div>
    </header>
  );
}

export async function SiteFooter() {
  const s = await getPlatformSettings();
  const links: [string, string][] = [
    ["/impressum", "Impressum"],
    ["/datenschutz", "Datenschutz"],
    ["/nutzungsbedingungen", "Nutzungsbedingungen"],
    ["/auftragsverarbeitung", "Auftragsverarbeitung"],
  ];
  return (
    <footer className="border-line bg-surface border-t">
      <div className="text-muted mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="flex items-center gap-2">
          <Mark className="text-loden size-5" />© {new Date().getFullYear()} {s.operatorName || platformName()}
        </p>
        <nav aria-label="Rechtliches" className="flex flex-wrap gap-x-6 gap-y-2">
          {links.map(([href, label]) => (
            <Link key={href} href={rootUrl(href)} className="hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
