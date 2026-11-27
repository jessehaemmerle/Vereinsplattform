import { redirect } from "next/navigation";
import { homeFor, requireUser } from "@/lib/auth";
import { ActionForm, Input, SubmitButton } from "@/components/ui/form";
import { changeInitialPassword, logout } from "../actions";

export const metadata = { title: "Eigenes Passwort festlegen" };

export default async function ChangeInitialPasswordPage() {
  const user = await requireUser({ allowPasswordChange: true, allowMfaSetup: true });
  if (!user.passwordChangeRequired) redirect(homeFor(user));
  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Eigenes Passwort festlegen</h1>
      <p className="text-muted mt-1 mb-8">
        Du hast dich mit einem Einmal-Passwort angemeldet. Lege jetzt für <strong className="text-ink">{user.email}</strong> ein eigenes Passwort fest – mindestens
        10 Zeichen, ein kurzer Satz ist leichter zu merken als Sonderzeichen.
      </p>
      <ActionForm action={changeInitialPassword}>
        <Input label="Neues Passwort" name="password" type="password" autoComplete="new-password" required minLength={10} autoFocus />
        <Input label="Passwort wiederholen" name="confirm" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full">Passwort speichern</SubmitButton>
      </ActionForm>
      <form action={logout} className="mt-6">
        <button className="text-muted text-sm underline-offset-4 hover:underline">Abmelden</button>
      </form>
    </>
  );
}
