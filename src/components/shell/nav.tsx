"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string; icon: ReactNode };

export function Shell({ brand, items, footer, children }: { brand: ReactNode; items: NavItem[]; footer: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const nav = (
    <nav className="flex flex-col gap-0.5" aria-label="Hauptnavigation">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-rail-ink/75 hover:text-rail-ink flex items-center gap-3 rounded-md px-3 py-2 text-[15px] transition-colors hover:bg-white/5",
              active && "text-rail-ink bg-white/10 font-medium",
            )}
          >
            <span className="[&>svg]:size-[18px]">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <header className="bg-rail text-rail-ink sticky top-0 z-30 flex items-center justify-between px-4 py-3 lg:hidden">
        <div className="min-w-0 truncate">{brand}</div>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menü" className="rounded p-1.5 hover:bg-white/10">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>
      {open && (
        <div className="bg-rail text-rail-ink fixed inset-x-0 top-[52px] bottom-0 z-20 overflow-y-auto p-4 lg:hidden">
          {nav}
          <div className="mt-6 border-t border-white/10 pt-4">{footer}</div>
        </div>
      )}
      <aside className="bg-rail text-rail-ink sticky top-0 hidden h-dvh flex-col px-4 py-6 lg:flex">
        <div className="mb-8 px-3">{brand}</div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        <div className="border-t border-white/10 pt-4">{footer}</div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-12">{children}</main>
    </div>
  );
}
