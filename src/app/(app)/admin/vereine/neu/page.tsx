import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { ClubCreateForm } from "../../forms";

export const metadata = { title: "Verein anlegen" };

export default async function NewClubPage() {
  await requirePlatformAdmin();
  const licenses = await db.license.findMany({ where: { clubId: null, status: { in: ["ACTIVE", "TRIAL"] } }, orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Verein anlegen" />
      <ClubCreateForm licenses={licenses.map((l) => ({ id: l.id, label: `${l.name} (${l.key})` }))} />
    </>
  );
}
