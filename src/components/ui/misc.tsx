import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="text-muted mt-1 max-w-prose">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-line bg-surface rounded-lg border", className)}>
      {(title || actions) && (
        <header className="border-line flex items-center justify-between gap-4 border-b px-5 py-3">
          {title && <h2 className="font-semibold">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const badgeTones = {
  neutral: "bg-line/60 text-ink",
  ok: "bg-ok-soft text-ok",
  warn: "bg-brass-soft text-brass",
  danger: "bg-danger-soft text-danger",
  loden: "bg-loden-soft text-loden",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof badgeTones; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", badgeTones[tone])}>{children}</span>;
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-line rounded-lg border border-dashed px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <p className="text-muted mx-auto mt-1 max-w-md text-sm">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="border-line bg-surface overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-line text-muted border-b">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-2.5 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-line divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger"; children: ReactNode }) {
  const tones = { info: "border-loden/30 bg-loden-soft", warn: "border-brass/40 bg-brass-soft", danger: "border-danger/40 bg-danger-soft" };
  return <div className={cn("rounded-md border px-4 py-3 text-sm", tones[tone])}>{children}</div>;
}

export function Dl({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted text-sm">{k}</dt>
          <dd className="text-[15px]">{v ?? "–"}</dd>
        </div>
      ))}
    </dl>
  );
}
