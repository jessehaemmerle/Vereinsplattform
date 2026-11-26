import { requireUser } from "@/lib/auth";
import { ClubShell } from "@/components/shell/club-shell";

/** Pages reachable even while a required second factor is not yet set up. */
export default async function SecureLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser({ allowMfaSetup: true });
  return <ClubShell user={user}>{children}</ClubShell>;
}
