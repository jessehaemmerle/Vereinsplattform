import {
  BadgeEuro,
  Building2,
  CalendarDays,
  FileText,
  Gauge,
  KeyRound,
  Landmark,
  LogOut,
  Mail,
  NotebookPen,
  Package,
  Settings,
  ShieldAlert,
  Users,
  UserRound,
} from "lucide-react";
import type { Module } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { can, ROLE_LABELS } from "@/lib/permissions";
import { logout } from "@/app/(auth)/actions";
import { Shell, type NavItem } from "@/components/shell/nav";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";

const footerBtn = "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-rail-ink/70 hover:bg-white/5 hover:text-rail-ink";
const timeFmt = new Intl.DateTimeFormat("de-AT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });

export function ClubShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  const club = user.club;
  const items: NavItem[] = [];
  const add = (cond: boolean, item: NavItem) => cond && items.push(item);

  if (!club) {
    // admin host: platform administration
    add(true, { href: "/admin", label: "Vereine", icon: <Building2 /> });
    add(true, { href: "/admin/lizenzen", label: "Lizenzen", icon: <KeyRound /> });
    add(true, { href: "/admin/pakete", label: "Pakete", icon: <Package /> });
  } else {
    const modules = new Set<Module>(club.modules);
    if (user.role !== "MITGLIED") {
      add(true, { href: "/dashboard", label: "Übersicht", icon: <Gauge /> });
      add(modules.has("MITGLIEDER") && can(user.role, "members:read"), { href: "/mitglieder", label: "Mitglieder", icon: <Users /> });
      add(modules.has("FINANZEN") && can(user.role, "finance:read"), { href: "/finanzen", label: "Finanzen", icon: <Landmark /> });
      add(modules.has("EVENTS") && can(user.role, "events:read"), { href: "/events", label: "Termine", icon: <CalendarDays /> });
      add(modules.has("NOTIZEN") && can(user.role, "notes:read"), { href: "/notizen", label: "Notizen", icon: <NotebookPen /> });
      add(modules.has("DOKUMENTE") && can(user.role, "docs:read"), { href: "/dokumente", label: "Dokumente", icon: <FileText /> });
      add(modules.has("KOMMUNIKATION") && can(user.role, "mail:send"), { href: "/nachrichten", label: "Nachrichten", icon: <Mail /> });
    }
    if (user.member) add(true, { href: "/mein-bereich", label: "Mein Bereich", icon: <UserRound /> });
    if (user.role !== "MITGLIED") add(true, { href: "/einstellungen", label: "Einstellungen", icon: <Settings /> });
  }

  const brand = (
    <div className="flex items-center gap-3">
      {club ? <BrandLogo club={club} className="size-9 shrink-0 rounded bg-white p-0.5" /> : <BadgeEuro className="size-7 shrink-0" />}
      <div className="min-w-0">
        <p className="truncate text-[17px] leading-tight font-semibold">{club?.name ?? "Vereinsplattform"}</p>
        <p className="text-rail-ink/60 truncate text-xs">{club ? ROLE_LABELS[user.role] : "Plattform-Verwaltung"}</p>
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
          {user.impersonating ? "Zurück zur Plattform" : "Abmelden"}
        </button>
      </form>
      {club && <p className="text-rail-ink/40 px-3 pt-3 text-[11px]">powered by Vereinsplattform</p>}
    </div>
  );

  const banner = user.impersonating ? (
    <div role="status" className="bg-danger sticky top-0 z-40 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-sm text-white lg:top-0">
      <span className="flex items-center gap-2 font-medium">
        <ShieldAlert className="size-4" /> Du bist als Plattform-Admin in diesem Verein angemeldet. Alle Aktionen werden protokolliert.
      </span>
      <span>Sitzung endet um {timeFmt.format(user.impersonating.until)} Uhr</span>
    </div>
  ) : null;

  return (
    <Shell brand={brand} items={items} footer={footer} banner={banner}>
      {children}
    </Shell>
  );
}
