import Link from "next/link";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { Badge, EmptyState, PageHeader } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { markRequestHandled } from "../actions";

export const metadata = { title: "Anfragen" };

export default async function RequestsPage() {
  await requirePlatformAdmin();
  const requests = await db.contactRequest.findMany({
    orderBy: [{ handledAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 200,
    include: { plan: true },
  });
  const open = requests.filter((r) => !r.handledAt).length;
  return (
    <>
      <PageHeader title="Anfragen" description={`${open} offen · Anfragen kommen über das Formular auf der Startseite.`} />
      {requests.length === 0 ? (
        <EmptyState title="Noch keine Anfragen" />
      ) : (
        <ul className="space-y-4">
          {requests.map((r) => (
            <li key={r.id} id={r.id} className={`border-line bg-surface rounded-lg border p-5 ${r.handledAt ? "opacity-60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {r.clubName} {r.plan && <Badge tone="loden">{r.plan.name}</Badge>}{" "}
                    {r.handledAt ? <Badge tone="ok">erledigt</Badge> : <Badge tone="warn">offen</Badge>}
                  </p>
                  <p className="text-muted text-sm">
                    {r.name} ·{" "}
                    <a href={`mailto:${r.email}`} className="text-loden hover:underline">
                      {r.email}
                    </a>
                    {r.phone ? ` · ${r.phone}` : ""}
                    {r.members ? ` · ca. ${r.members} Mitglieder` : ""} · {formatDateTime(r.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {!r.handledAt && (
                    <Link
                      href={`/admin/vereine/neu?name=${encodeURIComponent(r.clubName)}&adminName=${encodeURIComponent(r.name)}&adminEmail=${encodeURIComponent(r.email)}`}
                      className="border-line hover:border-loden inline-flex h-8 items-center rounded-md border px-3 text-sm"
                    >
                      Verein anlegen
                    </Link>
                  )}
                  <ActionButton action={markRequestHandled} fields={{ id: r.id }} variant="ghost">
                    {r.handledAt ? "Wieder öffnen" : "Erledigt"}
                  </ActionButton>
                </div>
              </div>
              {r.message && <p className="mt-3 text-sm whitespace-pre-wrap">{r.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
