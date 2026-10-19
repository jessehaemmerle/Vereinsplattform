import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "bg-loden text-white hover:bg-loden-strong dark:text-paper",
  secondary: "border border-line bg-surface text-ink hover:border-loden hover:text-loden",
  ghost: "text-muted hover:bg-loden-soft hover:text-ink",
  danger: "border border-danger/40 bg-surface text-danger hover:bg-danger-soft",
};

export type ButtonVariant = keyof typeof variants;

export function buttonClass(variant: ButtonVariant = "primary", size: "sm" | "md" = "md") {
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
    size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-[15px]",
    variants[variant],
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <button className={cn(buttonClass(variant, size), className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return <Link className={cn(buttonClass(variant, size), className)} {...props} />;
}
