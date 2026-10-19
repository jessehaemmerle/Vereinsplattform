import { viennaYear } from "@/lib/format";
import Link from "next/link";
import { Cake } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { activeLicense } from "@/lib/license";
import { balance } from "@/lib/finance";
import { formatDate, formatDateTime, formatEur, ageOn } from "@/lib/format";
import { Notice, PageHeader, Panel } from "@/components/ui/misc";

export const metadata = { title: "Übersicht" };

const ACTIONS: Record<string, string> = {
  login: "hat sich angemeldet",
  member_created: "hat ein Mitglied angelegt",
  member_updated: "hat ein Mitglied geändert",
  member_deleted: "hat ein Mitglied gelöscht",
  members_imported: "hat Mitglieder importiert",
  fee_toggled: "hat einen Beitrag verbucht",
  transaction_created: "hat eine Buchung erfasst",
  transaction_updated: "hat eine Buchung geändert",
  transaction_deleted: "hat eine Buchung gelöscht",
  event_created: "hat einen Termin angelegt",
  event_updated: "hat einen Termin geändert",
  event_deleted: "hat einen Termin gelöscht",
  document_uploaded: "hat ein Dokument hochgeladen",
  circular_sent: "hat ein Rundschreiben gesendet",
  member_access_requested: "hat einen Mitgliederzugang angefordert",
  settings_updated: "hat Vereinsdaten geändert",
  user_invited: "hat einen Zugang angelegt",
};

function upcomingBirthdays(members: { id: string; firstName: string; lastName: string; birthday: Date | null }[], days = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return members
    .filter((m) => m.birthday)
    .map((m) => {
      const b = m.birthday!;
      let next = new Date(today.getFullYear(), b.getUTCMonth(), b.getUTCDate());
      if (next < today) next = new Date(today.getFullYear() + 1, b.getUTCMonth(), b.getUTCDate());
      return { ...m, next, turns: ageOn(b, next) };
    })
    .filter((m) => (m.next.getTime() - today.getTime()) / 86_400_000 <= days)
    .sort((a, b) => a.next.getTime() - b.next.getTime());
}

function expiresWithin(date: Date, days: number) {
  return date.getTime() - Date.now() < days * 86_400_000;
}

export default async function DashboardPage() {
  const user = await requirePermission("members:read");
  const clubId = user.clubId;
  const year = viennaYear();
  const mods = new Set(user.club.modules);
  const showFinance = mods.has("FINANZEN") && can(user.role, "finance:read");

  const [license, memberCounts, unpaid, events, txs, birthdays, activity] = await Promise.all([
    activeLicense(clubId),
    db.member.groupBy({ by: ["status"], where: { clubId }, _count: true }),
    db.member.aggregate({
      where: { clubId, status: { not: "AUSGETRETEN" }, fee: { gt: 0 }, OR: [{ feePaidYear: null }, { feePaidYear: { not: year } }] },
      _count: true,
      _sum: { fee: true },
    }),
    mods.has("EVENTS") ? db.event.findMany({ where: { clubId, startsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 5 }) : [],
    showFinance ? db.transaction.findMany({ where: { clubId }, select: { type: true, amount: true, date: true, category: true } }) : [],
    db.member.findMany({
      where: { clubId, status: { not: "AUSGETRETEN" }, birthday: { not: null } },
      select: { id: true, firstName: true, lastName: true, birthday: true },
    }),
    db.activity.findMany({ where: { clubId, action: { not: "login" } }, orderBy: { createdAt: "desc" }, take: 8, include: { user: true } }),
  ]);
  const counts = Object.fromEntries(memberCounts.map((c) => [c.status, c._count]));
  const activeMembers = (counts.AKTIV ?? 0) + (counts.PASSIV ?? 0) + (counts.EHRENMITGLIED ?? 0);
  const cash = balance(txs, user.club.openingBalance);
  const thisYear = txs.filter((t) => t.date.getUTCFullYear() === year);
  const income = balance(
    thisYear.filter((t) => t.type === "EINNAHME"),
    0,
  );
  const expense = -balance(
    thisYear.filter((t) => t.type === "AUSGABE"),
    0,
  );
  const bdays = upcomingBirthdays(birthdays);

  return (
    <>
      <PageHeader title={`Servus, ${user.name.split(" ")[0]}`} description={`${user.club.name} am ${formatDate(new Date())}`} />
      {!license && (
        <div className="mb-6">
          <Notice tone="danger">Für diesen Verein ist keine gültige Lizenz hinterlegt. Du kannst alles ansehen, aber nichts ändern.</Notice>
        </div>
      )}
      {license?.validUntil && expiresWithin(license.validUntil, 30) && (
        <div className="mb-6">
          <Notice tone="warn">Die Lizenz läuft am {formatDate(license.validUntil)} ab.</Notice>
        </div>
      )}

      {showFinance && (
        <section aria-label="Kassastand" className="bg-loden dark:text-paper mb-8 rounded-lg p-6 text-white sm:p-8">
          <p className="text-sm opacity-80">Kassastand</p>
          <p className="tabular mt-1 text-[44px] leading-none font-semibold tracking-[-0.02em] sm:text-[56px]">{formatEur(cash)}</p>
          <div className="mt-6 flex flex-wrap gap-x-10 gap-y-2 text-sm">
            <span>
              <span className="opacity-75">Einnahmen {year} </span>
              <strong>{formatEur(income)}</strong>
            </span>
            <span>
              <span className="opacity-75">Ausgaben {year} </span>
              <strong>{formatEur(expense)}</strong>
            </span>
            <Link href="/finanzen" className="underline-offset-4 hover:underline">
              Zum Kassabuch
            </Link>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Mitglieder">
          <p className="text-3xl font-semibold">{activeMembers}</p>
          <p className="text-muted text-sm">
            {counts.AKTIV ?? 0} aktiv · {counts.PASSIV ?? 0} passiv · {counts.EHRENMITGLIED ?? 0} Ehrenmitglieder
          </p>
          {unpaid._count > 0 && (
            <Link href="/mitglieder?status=offen" className="bg-brass-soft text-brass mt-4 block rounded-md px-3 py-2 text-sm hover:underline">
              {unpaid._count} Beiträge {year} offen ({formatEur(unpaid._sum.fee)})
            </Link>
          )}
          {license?.maxMembers && <p className="text-muted mt-3 text-xs">Lizenz: bis {license.maxMembers} Mitglieder</p>}
        </Panel>
        <Panel title="Nächste Termine">
          {events.length === 0 ? (
            <p className="text-muted text-sm">Keine Termine geplant.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {events.map((e) => (
                <li key={e.id}>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-muted">{formatDateTime(e.startsAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Geburtstage, nächste 30 Tage">
          {bdays.length === 0 ? (
            <p className="text-muted text-sm">Keine.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {bdays.slice(0, 8).map((m) => (
                <li key={m.id} className="flex items-center gap-2">
                  <Cake className="text-brass size-4 shrink-0" />
                  <Link href={`/mitglieder/${m.id}`} className="flex-1 hover:underline">
                    {m.firstName} {m.lastName}
                  </Link>
                  <span className="text-muted">
                    {formatDate(m.next).slice(0, 6)} · {m.turns}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Zuletzt passiert" className="mt-6">
        {activity.length === 0 ? (
          <p className="text-muted text-sm">Noch keine Aktivität.</p>
        ) : (
          <ul className="divide-line divide-y text-sm">
            {activity.map((a) => (
              <li key={a.id} className="flex flex-col justify-between gap-1 py-2 sm:flex-row">
                <span>
                  <strong className="font-medium">{a.user?.name ?? "Jemand"}</strong> {ACTIONS[a.action] ?? a.action}
                  {a.detail && <span className="text-muted"> – {a.detail}</span>}
                </span>
                <span className="text-muted shrink-0">{formatDateTime(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
