import type { Club } from "@prisma/client";
import { assetUrl } from "@/lib/branding";
import { cn } from "@/lib/cn";

/** Club logo with an optional separate variant for dark mode. */
export function BrandLogo({ club, className }: { club: Club; className?: string }) {
  const light = assetUrl(club, "logo");
  const dark = assetUrl(club, "logo-dunkel");
  if (!light && !dark) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={(light ?? dark)!} alt={`Logo ${club.name}`} className={cn("object-contain", dark && "dark:hidden", className)} />
      {dark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dark} alt={`Logo ${club.name}`} className={cn("hidden object-contain dark:block", className)} />
      )}
    </>
  );
}
