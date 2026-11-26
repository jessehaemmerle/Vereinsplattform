import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { baseDomain } from "@/lib/hosts";
import { PageHeader } from "@/components/ui/misc";
import { ClubCreateForm } from "../../forms";

export const metadata = { title: "Verein anlegen" };

export default async function NewClubPage() {
  await requirePlatformAdmin();
  const [plans, licenses] = await Promise.all([
    db.licensePlan.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    db.license.findMany({ where: { clubId: null, status: { in: ["ACTIVE", "TRIAL"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const options = [
    ...plans.map((p) => ({ value: `plan:${p.id}`, label: `Neue Lizenz aus Paket „${p.name}“` })),
    ...licenses.map((l) => ({ value: `license:${l.id}`, label: `Bestehende Lizenz: ${l.name} (${l.key})` })),
  ];
  return (
    <>
      <PageHeader title="Verein anlegen" />
      <ClubCreateForm licenseOptions={options} baseDomain={baseDomain()} />
    </>
  );
}
