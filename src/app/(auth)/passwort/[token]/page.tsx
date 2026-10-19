import Link from "next/link";
import { findValidToken } from "@/lib/tokens";
import { ActionForm, Input, SubmitButton } from "@/components/ui/form";
import { setPassword } from "../../actions";

export const metadata = { title: "Passwort festlegen" };

export default async function SetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await findValidToken(token);
  if (!row) {
    return (
      <>
        <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Link nicht mehr gültig</h1>
        <p className="text-muted mt-2">Der Link ist abgelaufen oder wurde schon verwendet.</p>
        <p className="mt-6">
          <Link href="/passwort-vergessen" className="text-loden underline-offset-4 hover:underline">
            Neuen Link anfordern
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Passwort festlegen</h1>
      <p className="text-muted mt-1 mb-8">
        Für <strong className="text-ink">{row.user.email}</strong>. Mindestens 10 Zeichen – ein kurzer Satz ist leichter zu merken als Sonderzeichen.
      </p>
      <ActionForm action={setPassword}>
        <input type="hidden" name="token" value={token} />
        <Input label="Neues Passwort" name="password" type="password" autoComplete="new-password" required minLength={10} autoFocus />
        <Input label="Passwort wiederholen" name="confirm" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full">Passwort speichern</SubmitButton>
      </ActionForm>
    </>
  );
}
