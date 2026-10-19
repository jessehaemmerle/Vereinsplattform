import { staff } from "@/lib/guard";
import { PageHeader } from "@/components/ui/misc";
import { TxForm } from "../tx-form";
import { txFormData } from "../data";
import { saveTransaction } from "../actions";

export const metadata = { title: "Buchung erfassen" };

export default async function NewTxPage() {
  const user = await staff("finance:write", "FINANZEN");
  const data = await txFormData(user.clubId);
  return (
    <>
      <PageHeader title="Buchung erfassen" />
      <TxForm action={saveTransaction.bind(null, null)} {...data} />
    </>
  );
}
