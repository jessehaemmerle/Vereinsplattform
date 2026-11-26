import { getTenant } from "@/lib/tenant";
import { assetUrl } from "@/lib/branding";
import { BrandLogo } from "@/components/brand-logo";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const tenant = await getTenant();
  const club = tenant.kind === "club" ? tenant.club : null;
  const image = club ? assetUrl(club, "login-bild") : null;
  const title = club ? club.loginTitle || club.name : tenant.kind === "admin" ? "Plattform-Verwaltung" : "Vereinsplattform";
  const text = club
    ? club.loginText || "Mitgliederbereich und Vereinsverwaltung. Melde dich mit der E-Mail-Adresse an, die der Verein von dir hat."
    : "Vereine, Lizenzen und Pakete der Plattform verwalten.";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="bg-rail text-rail-ink relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        {image && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
            <div className="from-rail via-rail/80 to-rail/30 absolute inset-0 bg-gradient-to-t" />
          </>
        )}
        <div className="relative flex items-center gap-3">
          {club && <BrandLogo club={club} className="size-12 rounded bg-white p-1" />}
          <span className="text-lg font-semibold">{club?.name ?? "Vereinsplattform"}</span>
        </div>
        <div className="relative">
          <p className="max-w-md text-[40px] leading-[1.1] font-semibold tracking-[-0.02em] break-words">{title}</p>
          <p className="text-rail-ink/80 mt-6 max-w-sm whitespace-pre-line">{text}</p>
        </div>
        {!image && (
          <svg aria-hidden className="text-rail-ink/[0.06] absolute -right-24 -bottom-24 size-[420px]" viewBox="0 0 100 100">
            {Array.from({ length: 8 }, (_, i) => (
              <circle key={i} cx="50" cy="50" r={8 + i * 6} fill="none" stroke="currentColor" strokeWidth="1.2" />
            ))}
          </svg>
        )}
      </aside>
      <main className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          {club && (
            <div className="mb-8 flex items-center gap-3 lg:hidden">
              <BrandLogo club={club} className="size-10" />
              <span className="font-semibold">{club.name}</span>
            </div>
          )}
          {children}
        </div>
        <p className="text-muted/70 mt-16 text-xs">powered by Vereinsplattform</p>
      </main>
    </div>
  );
}
