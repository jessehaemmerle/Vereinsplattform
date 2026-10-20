import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { ActionForm, Input, SubmitButton } from "@/components/ui/form";
import { login } from "../actions";

export const metadata = { title: "Anmelden" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Anmelden</h1>
      <p className="text-muted mt-1 mb-8">Mit der E-Mail-Adresse, die dein Verein für dich hinterlegt hat.</p>
      <ActionForm action={login}>
        {next && <input type="hidden" name="next" value={next} />}
        <Input label="E-Mail" name="email" type="email" autoComplete="email" required autoFocus />
        <Input label="Passwort" name="password" type="password" autoComplete="current-password" required />
        <SubmitButton className="w-full" pendingText="Anmeldung läuft …">
          Anmelden
        </SubmitButton>
      </ActionForm>
      <div className="border-line mt-8 space-y-2 border-t pt-6 text-sm">
        <p>
          <Link href="/passwort-vergessen" className="text-loden underline-offset-4 hover:underline">
            Passwort vergessen?
          </Link>
        </p>
        <p className="text-muted">
          Du bist Mitglied, hast aber noch keinen Zugang?{" "}
          <Link href="/registrieren" className="text-loden underline-offset-4 hover:underline">
            Zugang anfordern
          </Link>
        </p>
      </div>
    </>
  );
}
