import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { PlanForm } from "../../forms";
import { deletePlan, savePlan } from "../../actions";

export const metadata = { title: "Paket" };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  if (id === "neu") {
    return (
      <>
        <PageHeader title="Paket anlegen" />
        <PlanForm action={savePlan.bind(null, null)} />
      </>
    );
  }
  const plan = await db.licensePlan.findUnique({ where: { id } });
  if (!plan) notFound();
  return (
    <>
      <PageHeader
        title={plan.name}
        description="Änderungen gelten für neu erstellte Lizenzen. Bestehende Lizenzen behalten ihre Werte."
        actions={
          <ActionButton action={deletePlan} fields={{ id }} variant="danger" size="md" confirm="Paket löschen? Lizenzen bleiben bestehen.">
            Löschen
          </ActionButton>
        }
      />
      <PlanForm
        action={savePlan.bind(null, id)}
        plan={{
          name: plan.name,
          description: plan.description ?? "",
          maxUsers: plan.maxUsers?.toString() ?? "",
          maxMembers: plan.maxMembers?.toString() ?? "",
          durationMonths: plan.durationMonths?.toString() ?? "",
          modules: plan.modules,
          active: plan.active,
          price: plan.priceCents == null ? "" : (plan.priceCents / 100).toFixed(2).replace(".", ","),
          publicListed: plan.publicListed,
          highlighted: plan.highlighted,
          sortOrder: String(plan.sortOrder),
        }}
      />
    </>
  );
}
