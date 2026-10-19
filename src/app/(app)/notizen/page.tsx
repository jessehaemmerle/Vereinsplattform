import Link from "next/link";
import { Pin, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { can } from "@/lib/permissions";
import { formatDateTime } from "@/lib/format";
import { LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/misc";

export const metadata = { title: "Notizen" };

export default async function NotesPage() {
  const user = await staff("notes:read", "NOTIZEN");
  const notes = await db.note.findMany({ where: { clubId: user.clubId }, orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }] });
  const canWrite = can(user.role, "notes:write");
  return (
    <>
      <PageHeader
        title="Notizen"
        description="Protokolle, Absprachen und Merkzettel für den Vorstand."
        actions={
          canWrite && (
            <LinkButton href="/notizen/neu">
              <Plus className="size-4" /> Notiz schreiben
            </LinkButton>
          )
        }
      />
      {notes.length === 0 ? (
        <EmptyState title="Noch keine Notizen" action={canWrite ? <LinkButton href="/notizen/neu">Notiz schreiben</LinkButton> : undefined} />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {notes.map((n) => (
            <li key={n.id} className="border-line bg-surface rounded-lg border p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">
                  {canWrite ? (
                    <Link href={`/notizen/${n.id}`} className="hover:text-loden hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                </h2>
                {n.pinned && <Pin className="text-brass size-4 shrink-0" aria-label="Angeheftet" />}
              </div>
              <p className="text-muted mt-1 text-xs">Zuletzt geändert {formatDateTime(n.updatedAt)}</p>
              <p className="mt-3 line-clamp-6 text-sm whitespace-pre-wrap">{n.content}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
