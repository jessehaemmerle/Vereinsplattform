import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { staff } from "@/lib/guard";
import { toDateInput } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { ActionButton } from "@/components/ui/confirm-form";
import { TxForm } from "../tx-form";
import { txFormData } from "../data";
import { deleteTransaction, saveTransaction } from "../actions";

export const metadata = { title: "Buchung bearbeiten" };

export default async function EditTxPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await staff("finance:write", "FINANZEN");
  const { id } = await params;
  const tx = await db.transaction.findFirst({ where: { id, clubId: user.clubId, eventId: null, feeYear: null } });
  if (!tx) notFound();
  const data = await txFormData(user.clubId);
  return (
    <>
      <PageHeader
        title="Buchung bearbeiten"
        actions={
          <ActionButton action={deleteTransaction} fields={{ id: tx.id }} variant="danger" size="md" confirm="Buchung endgültig löschen?">
            Löschen
          </ActionButton>
        }
      />
      <TxForm
        action={saveTransaction.bind(null, tx.id)}
        tx={{
          type: tx.type,
          category: tx.category,
          amount: tx.amount.toFixed(2).replace(".", ","),
          date: toDateInput(tx.date),
          description: tx.description,
          memberId: tx.memberId,
        }}
        {...data}
      />
    </>
  );
}
