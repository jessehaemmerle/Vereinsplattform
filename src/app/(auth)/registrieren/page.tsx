import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTenantClub } from "@/lib/tenant";
import { ActionForm, Input, SubmitButton } from "@/components/ui/form";
import { requestMemberAccess } from "../actions";

export const metadata = { title: "Zugang anfordern" };

export default async function RegisterPage() {
  const club = await requireTenantClub();
  if (!club) notFound();
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Zugang zum Mitgliederbereich</h1>
      <p className="text-muted mt-1 mb-8">
        Dort siehst du deine Daten, deinen Beitragsstatus, kommende Termine und die Dokumente des {club.name}. Den Link zum Festlegen des Passworts schicken wir
        an die Adresse, die der Verein von dir hat.
      </p>
      <ActionForm action={requestMemberAccess} resetOnOk>
        <Input label="Deine E-Mail-Adresse" name="email" type="email" autoComplete="email" required autoFocus />
        <SubmitButton className="w-full" pendingText="Wird gesendet …">
          Link anfordern
        </SubmitButton>
      </ActionForm>
      <p className="mt-8 text-sm">
        <Link href="/login" className="text-loden underline-offset-4 hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </>
  );
}
