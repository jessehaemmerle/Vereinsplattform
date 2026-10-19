import Link from "next/link";
import { CalendarPlus, MapPin, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatEur } from "@/lib/format";
import { appUrl } from "@/lib/tokens";
import { LinkButton } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui/misc";
import { CopyField } from "@/components/copy-field";

export const metadata = { title: "Termine" };

const day = new Intl.DateTimeFormat("de-AT", { day: "2-digit", timeZone: "Europe/Vienna" });
const month = new Intl.DateTimeFormat("de-AT", { month: "short", timeZone: "Europe/Vienna" });
const when = new Intl.DateTimeFormat("de-AT", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });
const yearFmt = new Intl.DateTimeFormat("de-AT", { year: "numeric", timeZone: "Europe/Vienna" });

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ vergangen?: string }> }) {
  const user = await staff("events:read", "EVENTS");
  const past = (await searchParams).vergangen === "1";
  const now = new Date();
  const events = await db.event.findMany({
    where: { clubId: user.clubId, startsAt: past ? { lt: now } : { gte: new Date(now.getTime() - 12 * 3_600_000) } },
    orderBy: { startsAt: past ? "desc" : "asc" },
    take: 200,
  });
  const canWrite = can(user.role, "events:write");
  const canMail = can(user.role, "mail:send") && user.club.modules.includes("KOMMUNIKATION");

  return (
    <>
      <PageHeader
        title="Termine"
        actions={
          canWrite && (
            <LinkButton href="/events/neu">
              <Plus className="size-4" /> Termin anlegen
            </LinkButton>
          )
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4 flex gap-1 text-sm" role="tablist">
            <Link href="/events" className={`rounded-md px-3 py-1.5 ${!past ? "bg-loden-soft text-loden font-medium" : "text-muted hover:text-ink"}`}>
              Kommende
            </Link>
            <Link
              href="/events?vergangen=1"
              className={`rounded-md px-3 py-1.5 ${past ? "bg-loden-soft text-loden font-medium" : "text-muted hover:text-ink"}`}
            >
              Vergangene
            </Link>
          </div>
          {events.length === 0 ? (
            <EmptyState
              title={past ? "Keine vergangenen Termine" : "Keine kommenden Termine"}
              action={canWrite && !past ? <LinkButton href="/events/neu">Termin anlegen</LinkButton> : undefined}
            />
          ) : (
            <ul className="divide-line border-line bg-surface divide-y rounded-lg border">
              {events.map((e) => (
                <li key={e.id} className="flex gap-5 p-5">
                  <div className="w-14 shrink-0 text-center">
                    <p className="text-loden text-2xl leading-none font-semibold">{day.format(e.startsAt)}</p>
                    <p className="text-muted mt-1 text-sm">{month.format(e.startsAt)}</p>
                    {past && <p className="text-muted text-xs">{yearFmt.format(e.startsAt)}</p>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {canWrite ? (
                        <Link href={`/events/${e.id}`} className="hover:text-loden hover:underline">
                          {e.title}
                        </Link>
                      ) : (
                        e.title
                      )}
                    </p>
                    <p className="text-muted mt-0.5 text-sm">
                      {when.format(e.startsAt)} Uhr
                      {e.location && (
                        <span className="ml-3 inline-flex items-center gap-1">
                          <MapPin className="size-3.5" /> {e.location}
                        </span>
                      )}
                    </p>
                    {e.description && <p className="mt-2 line-clamp-2 text-sm">{e.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {!e.public && <Badge>intern</Badge>}
                      {e.cost && <Badge tone="danger">Kosten {formatEur(e.cost)}</Badge>}
                    </div>
                  </div>
                  {canMail && !past && (
                    <LinkButton href={`/events/${e.id}/einladen`} variant="secondary" size="sm" className="self-start">
                      Einladen
                    </LinkButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Panel title="Kalender abonnieren">
          <p className="text-muted mb-3 text-sm">
            Diesen Link in Google Kalender, Outlook oder Apple Kalender als Abo hinzufügen. Sichtbar sind alle Termine, die für Mitglieder freigegeben sind.
          </p>
          <CopyField value={appUrl(`/api/kalender/${user.club.calendarToken}`)} />
          <p className="text-muted mt-3 flex items-center gap-2 text-sm">
            <CalendarPlus className="size-4" /> Google: „Andere Kalender“ → „Per URL“
          </p>
        </Panel>
      </div>
    </>
  );
}
