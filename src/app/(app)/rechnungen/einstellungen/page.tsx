import { staff } from "@/lib/guard";
import { PageHeader } from "@/components/ui/misc";
import { BillingForm } from "@/components/invoices/billing-form";
import { saveClubBilling } from "../actions";

export const metadata = { title: "Rechnungseinstellungen" };

export default async function ClubBillingPage() {
  const user = await staff("club:manage", "FINANZEN");
  return (
    <>
      <PageHeader
        title="Rechnungseinstellungen"
        description="Vereinsname und Anschrift kommen aus den Einstellungen des Vereins. Änderungen gelten für neu ausgestellte Rechnungen."
      />
      <BillingForm action={saveClubBilling} values={user.club} withVatId />
    </>
  );
}
