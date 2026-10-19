import Link from "next/link";
import { ActionForm, Input, SubmitButton } from "@/components/ui/form";
import { requestPasswordReset } from "../actions";

export const metadata = { title: "Passwort vergessen" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Passwort vergessen</h1>
      <p className="text-muted mt-1 mb-8">Wir schicken dir einen Link, über den du ein neues Passwort festlegst.</p>
      <ActionForm action={requestPasswordReset} resetOnOk>
        <Input label="E-Mail" name="email" type="email" autoComplete="email" required autoFocus />
        <SubmitButton className="w-full" pendingText="Wird gesendet …">
          Link senden
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
