"use client";

import { createContext, useActionState, useContext, useEffect, useId, useRef, useTransition, type ComponentProps, type ReactNode } from "react";
import type { FormState } from "@/lib/form";
import { cn } from "@/lib/cn";
import { Button, type ButtonVariant } from "@/components/ui/button";

const StateCtx = createContext<FormState>(undefined);
const PendingCtx = createContext(false);

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function ActionForm({ action, children, className, resetOnOk }: { action: Action; children: ReactNode; className?: string; resetOnOk?: boolean }) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnOk && state?.ok && !state.error) ref.current?.reset();
  }, [state, resetOnOk]);

  return (
    <StateCtx.Provider value={state}>
      <PendingCtx.Provider value={pending}>
        <form
          ref={ref}
          action={formAction}
          className={cn("space-y-5", className)}
          onSubmit={(e) => {
            // submit manually so React does not reset the fields (keeps input after validation errors)
            e.preventDefault();
            const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
            startTransition(() => formAction(data));
          }}
        >
          {state?.error && (
            <div role="alert" className="border-danger/40 bg-danger-soft text-danger rounded-md border px-4 py-3 text-sm">
              {state.error}
            </div>
          )}
          {state?.ok && (
            <div role="status" className="border-ok/30 bg-ok-soft text-ok rounded-md border px-4 py-3 text-sm">
              {state.ok}
            </div>
          )}
          {children}
        </form>
      </PendingCtx.Provider>
    </StateCtx.Provider>
  );
}

const inputBase =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-[15px] text-ink placeholder:text-muted/70 focus:border-loden focus:outline-none focus:ring-2 focus:ring-loden/20 aria-[invalid=true]:border-danger";

type FieldProps = { label: string; name: string; hint?: ReactNode; className?: string };

function FieldShell({ label, name, hint, className, children, id }: FieldProps & { children: ReactNode; id: string }) {
  const state = useContext(StateCtx);
  const error = state?.fieldErrors?.[name];
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="text-danger text-sm">
          {error}
        </p>
      ) : (
        hint && <p className="text-muted text-sm">{hint}</p>
      )}
    </div>
  );
}

function useInvalid(name: string) {
  const state = useContext(StateCtx);
  return !!state?.fieldErrors?.[name];
}

export function Input({ label, name, hint, className, ...props }: FieldProps & Omit<ComponentProps<"input">, "name">) {
  const id = useId();
  const invalid = useInvalid(name);
  return (
    <FieldShell label={label} name={name} hint={hint} className={className} id={id}>
      <input id={id} name={name} aria-invalid={invalid} aria-describedby={invalid ? `${id}-err` : undefined} className={inputBase} {...props} />
    </FieldShell>
  );
}

export function Textarea({ label, name, hint, className, ...props }: FieldProps & Omit<ComponentProps<"textarea">, "name">) {
  const id = useId();
  const invalid = useInvalid(name);
  return (
    <FieldShell label={label} name={name} hint={hint} className={className} id={id}>
      <textarea id={id} name={name} aria-invalid={invalid} rows={5} className={inputBase} {...props} />
    </FieldShell>
  );
}

export function Select({
  label,
  name,
  hint,
  className,
  options,
  ...props
}: FieldProps & Omit<ComponentProps<"select">, "name"> & { options: { value: string; label: string }[] }) {
  const id = useId();
  const invalid = useInvalid(name);
  return (
    <FieldShell label={label} name={name} hint={hint} className={className} id={id}>
      <select id={id} name={name} aria-invalid={invalid} className={inputBase} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function Checkbox({ label, name, hint, ...props }: { label: string; name: string; hint?: string } & Omit<ComponentProps<"input">, "name" | "type">) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input id={id} type="checkbox" name={name} className="mt-1 size-4 accent-[var(--loden)]" {...props} />
      <label htmlFor={id} className="text-[15px]">
        {label}
        {hint && <span className="text-muted block text-sm">{hint}</span>}
      </label>
    </div>
  );
}

export function SubmitButton({
  children,
  variant,
  className,
  pendingText,
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  pendingText?: string;
}) {
  const pending = useContext(PendingCtx);
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? (pendingText ?? "Wird gespeichert …") : children}
    </Button>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">{children}</div>;
}
