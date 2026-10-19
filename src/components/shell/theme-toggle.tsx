"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className }: { className?: string }) {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("vp-theme", dark ? "dark" : "light");
    } catch {}
  };
  return (
    <button type="button" onClick={toggle} className={className} aria-label="Hell/Dunkel umschalten">
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
      <span>Darstellung</span>
    </button>
  );
}
