import { CalendarDays, FileText, Gauge, Landmark, Mail, NotebookPen, Settings, ShieldCheck, Users, UserRound, LogOut } from "lucide-react";
import type { Module } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions";
import { logout } from "@/app/(auth)/actions";
import { Shell, type NavItem } from "@/components/shell/nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";

const footerBtn = "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-rail-ink/70 hover:bg-white/5 hover:text-rail-ink";

export function ClubShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const club = user.club;
  const modules = new Set<Module>(club?.modules ?? []);
  const items: NavItem[] = [];
  const add = (cond: boolean, item: NavItem) => cond && items.push(item);

  if (club && user.role !== "MITGLIED") {
    add(true, { href: "/dashboard", label: "Übersicht", icon: <Gauge /> });
    add(modules.has("MITGLIEDER") && can(user.role, "members:read"), { href: "/mitglieder", label: "Mitglieder", icon: <Users /> });
    add(modules.has("FINANZEN") && can(user.role, "finance:read"), { href: "/finanzen", label: "Finanzen", icon: <Landmark /> });
    add(modules.has("EVENTS") && can(user.role, "events:read"), { href: "/events", label: "Termine", icon: <CalendarDays /> });
    add(modules.has("NOTIZEN") && can(user.role, "notes:read"), { href: "/notizen", label: "Notizen", icon: <NotebookPen /> });
    add(modules.has("DOKUMENTE") && can(user.role, "docs:read"), { href: "/dokumente", label: "Dokumente", icon: <FileText /> });
    add(modules.has("KOMMUNIKATION") && can(user.role, "mail:send"), { href: "/nachrichten", label: "Nachrichten", icon: <Mail /> });
  }
  if (user.member) add(true, { href: "/mein-bereich", label: "Mein Bereich", icon: <UserRound /> });
  if (club && user.role !== "MITGLIED") add(true, { href: "/einstellungen", label: "Einstellungen", icon: <Settings /> });
  if (user.isPlatformAdmin) add(true, { href: "/admin", label: "Plattform", icon: <ShieldCheck /> });

  const brand = (
    <div className="flex items-center gap-3">
      {club?.logoPath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/logo/${club.id}`} alt="" className="size-9 shrink-0 rounded bg-white object-contain p-0.5" />
      )}
      <div className="min-w-0">
        <p className="truncate text-[17px] leading-tight font-semibold">{club?.name ?? "Vereinsplattform"}</p>
        <p className="text-rail-ink/60 truncate text-xs">{user.isPlatformAdmin && !club ? "Plattform-Verwaltung" : ROLE_LABELS[user.role]}</p>
      </div>
    </div>
  );

  const footer = (
    <div className="space-y-0.5">
      <p className="text-rail-ink/80 truncate px-3 pb-2 text-sm">{user.name}</p>
      <ThemeToggle className={footerBtn} />
      <form action={logout}>
        <button className={footerBtn}>
          <LogOut className="size-4" />
          Abmelden
        </button>
      </form>
    </div>
  );

  return (
    <Shell brand={brand} items={items} footer={footer}>
      {children}
    </Shell>
  );
}
