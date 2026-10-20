import Link from "next/link";
import { db } from "@/lib/db";
import { ActionForm, Input, Select, SubmitButton } from "@/components/ui/form";
import { requestMemberAccess } from "../actions";

export const metadata = { title: "Zugang anfordern" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ verein?: string }> }) {
  const { verein } = await searchParams;
  const clubs = await db.club.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" } });
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Zugang zum Mitgliederbereich</h1>
      <p className="text-muted mt-1 mb-8">
        Dort siehst du deine Daten, deinen Beitragsstatus, kommende Termine und die Dokumente deines Vereins. Den Link zum Festlegen des Passworts schicken wir
        an die Adresse, die der Verein von dir hat.
      </p>
      {clubs.length === 0 ? (
        <p className="text-muted">Es ist noch kein Verein eingerichtet.</p>
      ) : (
        <ActionForm action={requestMemberAccess} resetOnOk>
          <Select
            label="Verein"
            name="club"
            defaultValue={verein ?? ""}
            options={[{ value: "", label: "Bitte wählen" }, ...clubs.map((c) => ({ value: c.slug, label: c.name }))]}
            required
          />
          <Input label="Deine E-Mail-Adresse" name="email" type="email" autoComplete="email" required />
          <SubmitButton className="w-full" pendingText="Wird gesendet …">
            Link anfordern
          </SubmitButton>
        </ActionForm>
      )}
      <p className="mt-8 text-sm">
        <Link href="/login" className="text-loden underline-offset-4 hover:underline">
          Zurück zur Anmeldung
        </Link>
      </p>
    </>
  );
}
