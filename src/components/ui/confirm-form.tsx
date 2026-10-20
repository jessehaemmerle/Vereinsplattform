"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonVariant } from "@/components/ui/button";

function Submit({ children, variant, size }: { children: ReactNode; variant: ButtonVariant; size: "sm" | "md" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending}>
      {children}
    </Button>
  );
}

/** Small form posting to a server action, optionally asking for confirmation first. */
export function ActionButton({
  action,
  confirm,
  children,
  variant = "secondary",
  size = "sm",
  fields,
}: {
  action: (formData: FormData) => Promise<void>;
  confirm?: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  fields?: Record<string, string>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className="inline"
    >
      {fields && Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Submit variant={variant} size={size}>
        {children}
      </Submit>
    </form>
  );
}
