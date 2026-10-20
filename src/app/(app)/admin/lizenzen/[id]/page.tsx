import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { toDateInput } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { LicenseForm } from "../../forms";
import { deleteLicense, saveLicense } from "../../actions";

export const metadata = { title: "Lizenz" };

export default async function LicensePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const clubs = await db.club.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (id === "neu") {
    return (
      <>
        <PageHeader title="Lizenz erstellen" description="Der Lizenzschlüssel wird automatisch erzeugt." />
        <LicenseForm action={saveLicense.bind(null, null)} clubs={clubs} />
      </>
    );
  }
  const l = await db.license.findUnique({ where: { id } });
  if (!l) notFound();
  return (
    <>
      <PageHeader
        title={l.name}
        description={<span className="font-mono">{l.key}</span>}
        actions={
          <ActionButton
            action={deleteLicense}
            fields={{ id: l.id }}
            variant="danger"
            size="md"
            confirm="Lizenz löschen? Der zugewiesene Verein wird dadurch eventuell schreibgeschützt."
          >
            Löschen
          </ActionButton>
        }
      />
      <LicenseForm
        action={saveLicense.bind(null, l.id)}
        clubs={clubs}
        license={{
          name: l.name,
          status: l.status,
          maxUsers: l.maxUsers?.toString() ?? "",
          maxMembers: l.maxMembers?.toString() ?? "",
          validFrom: toDateInput(l.validFrom),
          validUntil: toDateInput(l.validUntil),
          notes: l.notes ?? "",
          clubId: l.clubId ?? "",
        }}
      />
    </>
  );
}
