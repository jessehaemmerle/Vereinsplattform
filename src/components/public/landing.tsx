import { CalendarDays, Check, FileText, KeyRound, Landmark, Lock, Mail, Server, ShieldCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { baseDomain } from "@/lib/hosts";
import { formatEur } from "@/lib/format";
import { formToken } from "@/lib/form-token";
import { getPlatformSettings } from "@/lib/legal";
import { MODULE_LABELS } from "@/lib/modules";
import { ClubFinderForm } from "@/app/club-finder";
import { InquiryForm } from "./inquiry-form";
import { SiteFooter, SiteHeader } from "./site-chrome";

const FEATURES = [
  {
    icon: Users,
    title: "Mitglieder",
    text: "Alle Daten an einem Ort, Import aus Excel, Status, Funktionen und Geburtstage. Kein Abgleich mehr zwischen drei Listen.",
  },
  {
    icon: Check,
    title: "Beiträge",
    text: "Mit einem Klick als bezahlt markieren – die Einnahme landet automatisch im Kassabuch. Offene Beiträge auf einen Blick.",
  },
  { icon: Landmark, title: "Kassabuch", text: "Einnahmen und Ausgaben mit Kategorien, Jahresübertrag und Jahresabschluss als PDF für die Kassaprüfung." },
  { icon: CalendarDays, title: "Termine", text: "Proben, Spiele, Versammlungen. Einladungen per E-Mail und ein Kalender-Link für Handy und Outlook." },
  { icon: Mail, title: "Rundschreiben", text: "An alle Aktiven oder nur an Mitglieder mit offenem Beitrag. Jede Person bekommt eine eigene E-Mail." },
  {
    icon: FileText,
    title: "Mitgliederbereich",
    text: "Mitglieder sehen ihren Beitrag, Termine und freigegebene Dokumente und halten ihre Adresse selbst aktuell.",
  },
];

const SECURITY = [
  { icon: Server, title: "Daten in der EU", text: "Betrieb auf Servern in der EU, Verschlüsselung bei jeder Verbindung." },
  { icon: Lock, title: "Jeder Verein für sich", text: "Eigene Adresse, getrennte Zugänge. Niemand sieht Daten eines anderen Vereins." },
  { icon: KeyRound, title: "Zwei-Faktor-Anmeldung", text: "Mit App oder Passkey – für den Vorstand auf Wunsch verpflichtend." },
  { icon: ShieldCheck, title: "DSGVO", text: "Auftragsverarbeitungsvertrag inklusive, Rollen für Kassier, Schriftführer und Vorstand." },
];

const FAQ: [string, string][] = [
  [
    "Brauchen wir dafür technisches Wissen?",
    "Nein. Wir richten euren Bereich ein, ihr bekommt einen Link zum Festlegen des Passworts. Die Mitgliederliste importiert ihr aus Excel.",
  ],
  [
    "Können wir unsere bestehenden Daten übernehmen?",
    "Ja. Mitglieder kommen per CSV-Datei, die ihr aus Excel oder eurer bisherigen Software speichert. Anfangsbestand der Kassa tragt ihr einmal ein.",
  ],
  [
    "Wer ist für die Daten unserer Mitglieder verantwortlich?",
    "Euer Verein bleibt Verantwortlicher im Sinne der DSGVO, wir verarbeiten die Daten in eurem Auftrag. Den Auftragsverarbeitungsvertrag findet ihr unten verlinkt.",
  ],
  [
    "Was passiert, wenn die Lizenz ausläuft?",
    "Ihr werdet 30, 7 und 1 Tag vorher erinnert. Danach bleiben alle Daten lesbar und exportierbar, nur Änderungen sind gesperrt.",
  ],
  [
    "Können Mitglieder selbst etwas sehen?",
    "Ja, wenn ihr wollt: Jedes Mitglied kann einen Zugang anfordern und sieht dann nur seine eigenen Daten, Termine und freigegebene Dokumente.",
  ],
];

function Screenshot({ src, alt, url, priority, className = "" }: { src: string; alt: string; url: string; priority?: boolean; className?: string }) {
  return (
    <figure className={`border-line overflow-hidden rounded-lg border bg-white shadow-[0_24px_60px_-28px_rgba(24,33,28,0.45)] ${className}`}>
      <div className="border-line flex items-center gap-2 border-b bg-[#f1f3f0] px-3 py-2">
        <span className="flex gap-1.5" aria-hidden>
          <i className="size-2.5 rounded-full bg-[#d9ddd8]" />
          <i className="size-2.5 rounded-full bg-[#d9ddd8]" />
          <i className="size-2.5 rounded-full bg-[#d9ddd8]" />
        </span>
        <span className="truncate rounded bg-white px-2 py-0.5 font-mono text-[11px] text-[#5d6a62]">{url}</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP, served as static file */}
      <img
        src={src}
        alt={alt}
        width={1600}
        height={1000}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        className="h-auto w-full"
      />
    </figure>
  );
}

export async function Landing({ notFound, planId }: { notFound?: boolean; planId?: string }) {
  const [plans, settings] = await Promise.all([
    db.licensePlan.findMany({ where: { publicListed: true, active: true }, orderBy: [{ sortOrder: "asc" }, { priceCents: "asc" }] }),
    getPlatformSettings(),
  ]);
  const domain = baseDomain().replace(/:\d+$/, "");

  return (
    <div className="bg-paper text-ink">
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-4 pt-14 pb-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:pt-20">
          <div>
            <h1 className="text-[40px] leading-[1.05] font-semibold tracking-[-0.025em] sm:text-[56px]">Die Vereinsverwaltung, die am Abend fertig wird.</h1>
            <p className="text-muted mt-6 max-w-xl text-lg leading-relaxed">
              Mitglieder, Beiträge, Kassabuch und Termine an einem Ort – mit eigener Adresse und im Erscheinungsbild eures Vereins. Für alle, die Vereinsarbeit
              ehrenamtlich neben dem Beruf machen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#anfrage" className="bg-loden hover:bg-loden-strong inline-flex h-11 items-center rounded-md px-5 font-medium text-white">
                Zugang für euren Verein anfragen
              </a>
              <a href="#funktionen" className="border-line bg-surface hover:border-loden inline-flex h-11 items-center rounded-md border px-5 font-medium">
                Funktionen ansehen
              </a>
            </div>
            <ul className="text-muted mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Server className="text-loden size-4" /> Server in der EU
              </li>
              <li className="flex items-center gap-2">
                <KeyRound className="text-loden size-4" /> Zwei-Faktor-Anmeldung
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="text-loden size-4" /> DSGVO-Auftragsverarbeitung
              </li>
            </ul>
          </div>
          <Screenshot
            src="/landing/dashboard-musikverein.webp"
            alt="Übersicht eines Musikvereins mit Kassastand, Mitgliedern und nächsten Terminen"
            url={`musikverein-gruenbach.${domain}`}
            priority
          />
        </section>

        {/* Features */}
        <section id="funktionen" className="border-line bg-surface scroll-mt-16 border-y">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
            <h2 className="max-w-2xl text-[32px] leading-tight font-semibold tracking-[-0.015em]">Was der Vorstand jeden Monat braucht – und nicht mehr.</h2>
            <dl className="border-line mt-12 grid gap-px overflow-hidden rounded-lg border bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="bg-surface p-6">
                  <dt className="flex items-center gap-3 font-semibold">
                    <f.icon className="text-loden size-5" /> {f.title}
                  </dt>
                  <dd className="text-muted mt-2 leading-relaxed">{f.text}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-14 grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]">
              <Screenshot
                src="/landing/finanzen.webp"
                alt="Kassabuch mit Einnahmen, Ausgaben und PDF-Berichten"
                url={`musikverein-gruenbach.${domain}/finanzen`}
              />
              <div>
                <h3 className="text-xl font-semibold">Kassaprüfung ohne Schuhschachtel</h3>
                <p className="text-muted mt-3 leading-relaxed">
                  Jede Buchung mit Datum, Kategorie und Beleg-Beschreibung. Der Jahresabschluss, das Buchungsjournal mit laufendem Kassastand und die Summen je
                  Kategorie sind jederzeit als PDF da – mit eurem Logo im Briefkopf.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* White label */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)]">
            <div>
              <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.015em]">Eure Adresse. Eure Farben.</h2>
              <p className="text-muted mt-4 leading-relaxed">
                Jeder Verein bekommt eine eigene Adresse unter {domain} und gestaltet sie selbst: Farben, Schrift, Logo und die Anmeldeseite. Auch E-Mails und
                PDF-Berichte tragen euren Namen.
              </p>
              <ul className="mt-6 space-y-2">
                {[
                  "Farben mit automatischer Lesbarkeits-Prüfung",
                  "Logo, Browser-Symbol, eigenes Anmeldebild",
                  "E-Mails mit eurem Namen als Absender",
                  "Hell- und Dunkelmodus",
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2">
                    <Check className="text-loden mt-1 size-4 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative pb-16 sm:pb-24">
              <Screenshot
                src="/landing/dashboard-musikverein.webp"
                alt="Musikverein mit weinroter Gestaltung"
                url={`musikverein-gruenbach.${domain}`}
                className="w-[82%]"
              />
              <Screenshot
                src="/landing/dashboard-sportunion.webp"
                alt="Die gleiche Ansicht bei einer Sportunion in Blau"
                url={`sportunion-tal.${domain}`}
                className="absolute right-0 bottom-0 w-[70%]"
              />
            </div>
          </div>
        </section>

        {/* Security */}
        <section id="sicherheit" className="bg-rail text-rail-ink scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
            <h2 className="max-w-2xl text-[32px] leading-tight font-semibold tracking-[-0.015em]">
              Mitgliederdaten gehören nicht in eine Excel-Datei im E-Mail-Postfach.
            </h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {SECURITY.map((s) => (
                <div key={s.title}>
                  <s.icon className="size-6 opacity-90" />
                  <h3 className="mt-4 font-semibold">{s.title}</h3>
                  <p className="text-rail-ink/75 mt-2 leading-relaxed">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="preise" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-24 sm:px-8">
          <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.015em]">Preise</h2>
          <p className="text-muted mt-3 max-w-2xl">
            Ein Jahrespreis pro Verein, unabhängig davon, wie viele aus dem Vorstand mitarbeiten. Alle Preise inklusive Umsatzsteuer.
          </p>
          {plans.length === 0 ? (
            <p className="mt-8 text-lg">Die Preise richten sich nach der Größe eures Vereins – fragt uns einfach an.</p>
          ) : (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((p) => (
                <div
                  key={p.id}
                  className={`bg-surface flex flex-col rounded-lg border p-6 ${p.highlighted ? "border-loden ring-loden/20 ring-4" : "border-line"}`}
                >
                  <p className="flex items-center justify-between gap-2 font-semibold">
                    {p.name}
                    {p.highlighted && <span className="bg-loden-soft text-loden rounded px-2 py-0.5 text-xs">Empfohlen</span>}
                  </p>
                  <p className="mt-4">
                    {p.priceCents == null ? (
                      <span className="text-2xl font-semibold">auf Anfrage</span>
                    ) : (
                      <>
                        <span className="text-[36px] font-semibold tracking-tight">{formatEur(p.priceCents / 100).replace(",00", "")}</span>
                        <span className="text-muted"> / Jahr</span>
                      </>
                    )}
                  </p>
                  {p.description && <p className="text-muted mt-2 text-sm">{p.description}</p>}
                  <ul className="mt-6 flex-1 space-y-2 text-[15px]">
                    <li className="flex gap-2">
                      <Check className="text-loden mt-0.5 size-4 shrink-0" /> {p.maxMembers ? `bis ${p.maxMembers} Mitglieder` : "unbegrenzt viele Mitglieder"}
                    </li>
                    <li className="flex gap-2">
                      <Check className="text-loden mt-0.5 size-4 shrink-0" />{" "}
                      {p.maxUsers ? `${p.maxUsers} Vorstandszugänge` : "unbegrenzt viele Vorstandszugänge"}
                    </li>
                    <li className="flex gap-2">
                      <Check className="text-loden mt-0.5 size-4 shrink-0" /> {p.modules.map((m) => MODULE_LABELS[m]).join(", ")}
                    </li>
                    <li className="flex gap-2">
                      <Check className="text-loden mt-0.5 size-4 shrink-0" /> Eigene Adresse und Erscheinungsbild
                    </li>
                  </ul>
                  <a
                    href={`/?paket=${p.id}#anfrage`}
                    className={`mt-6 inline-flex h-10 items-center justify-center rounded-md px-4 font-medium ${p.highlighted ? "bg-loden hover:bg-loden-strong text-white" : "border-line hover:border-loden border"}`}
                  >
                    {p.name} anfragen
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* FAQ */}
        <section id="fragen" className="border-line bg-surface scroll-mt-16 border-y">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-8">
            <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.015em]">Häufige Fragen</h2>
            <div className="divide-line border-line mt-8 divide-y border-y">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                    {q}
                    <span className="text-loden text-xl transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="text-muted mt-3 leading-relaxed">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Inquiry + login */}
        <section className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
          <div id="anfrage" className="scroll-mt-20">
            <h2 className="text-[32px] leading-tight font-semibold tracking-[-0.015em]">Zugang für euren Verein anfragen</h2>
            <p className="text-muted mt-3 mb-8 max-w-xl">
              Wir melden uns innerhalb weniger Tage, richten euren Bereich ein und helfen beim Import der Mitgliederliste.
            </p>
            <InquiryForm token={formToken()} plans={plans.map((p) => ({ id: p.id, name: p.name }))} planId={planId} />
          </div>
          <aside id="anmelden" className="border-line bg-surface h-fit scroll-mt-20 rounded-lg border p-6">
            <h2 className="text-lg font-semibold">Schon dabei?</h2>
            <p className="text-muted mt-1 mb-5 text-sm">Gib die Adresse eures Vereins ein, wir bringen dich zur Anmeldung.</p>
            <ClubFinderForm notFound={notFound} />
            {settings.email && (
              <p className="text-muted mt-6 text-sm">
                Fragen? Schreib an{" "}
                <a href={`mailto:${settings.email}`} className="text-loden hover:underline">
                  {settings.email}
                </a>
                .
              </p>
            )}
          </aside>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
