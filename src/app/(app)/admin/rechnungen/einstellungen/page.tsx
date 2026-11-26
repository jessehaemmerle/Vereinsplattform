import { requirePlatformAdmin } from "@/lib/auth";
import { getPlatformSettings } from "@/lib/legal";
import { PageHeader } from "@/components/ui/misc";
import { BillingForm } from "@/components/invoices/billing-form";
import { savePlatformBilling } from "../actions";

export const metadata = { title: "Rechnungseinstellungen" };

export default async function PlatformBillingPage() {
  await requirePlatformAdmin();
  const s = await getPlatformSettings();
  return (
    <>
      <PageHeader
        title="Rechnungseinstellungen"
        description="Name, Anschrift und UID kommen aus „Rechtliches“. Änderungen gelten für neu ausgestellte Rechnungen; ausgestellte bleiben unverändert."
      />
      <BillingForm action={savePlatformBilling} values={s} vatIdHint="Die UID-Nummer trägst du unter „Rechtliches“ ein." />
    </>
  );
}
