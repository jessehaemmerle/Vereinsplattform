import { requireUser } from "@/lib/auth";
import { ClubShell } from "@/components/shell/club-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <ClubShell user={user}>{children}</ClubShell>;
}
