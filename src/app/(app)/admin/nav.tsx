import Link from "next/link";

export function AdminTabs({ active }: { active: "vereine" | "lizenzen" }) {
  const cls = (on: boolean) => `rounded-md px-3 py-1.5 ${on ? "bg-loden-soft font-medium text-loden" : "text-muted hover:text-ink"}`;
  return (
    <div className="mb-6 flex gap-1 text-sm">
      <Link href="/admin" className={cls(active === "vereine")}>
        Vereine
      </Link>
      <Link href="/admin/lizenzen" className={cls(active === "lizenzen")}>
        Lizenzen
      </Link>
    </div>
  );
}
