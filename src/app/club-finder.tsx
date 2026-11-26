import { redirect } from "next/navigation";
import { baseDomain, clubUrl, isValidSlug } from "@/lib/hosts";
import { slugify } from "@/lib/format";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";

async function go(formData: FormData) {
  "use server";
  const input = String(formData.get("verein") ?? "")
    .trim()
    .toLowerCase();
  const slug = isValidSlug(input) ? input : slugify(input);
  const club = slug ? await db.club.findFirst({ where: { OR: [{ slug }, { previousSlug: slug }] }, select: { slug: true } }) : null;
  redirect(club ? clubUrl(club.slug, "/login") : "/?nicht-gefunden=1");
}

/** Landing page on the bare domain: takes visitors to their club's own address without listing clubs. */
export function ClubFinder({ notFound }: { notFound?: boolean }) {
  return (
    <main className="bg-paper flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Zu deinem Verein</h1>
        <p className="text-muted mt-1 mb-8">Jeder Verein hat eine eigene Adresse. Gib sie ein, wir bringen dich zur Anmeldung.</p>
        {notFound && (
          <p role="alert" className="border-danger/40 bg-danger-soft text-danger mb-4 rounded-md border px-4 py-3 text-sm">
            Unter dieser Adresse haben wir keinen Verein gefunden.
          </p>
        )}
        <form action={go} className="space-y-3">
          <label htmlFor="verein" className="block text-sm font-medium">
            Adresse deines Vereins
          </label>
          <div className="border-line bg-surface focus-within:border-loden flex items-center rounded-md border">
            <input
              id="verein"
              name="verein"
              required
              autoFocus
              placeholder="musikverein"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 focus:outline-none"
            />
            <span className="text-muted pr-3 text-sm">.{baseDomain()}</span>
          </div>
          <Button className="w-full">Weiter</Button>
        </form>
      </div>
    </main>
  );
}
