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
  redirect(club ? clubUrl(club.slug, "/login") : "/?nicht-gefunden=1#anmelden");
}

/** Takes visitors to their club's own address without listing clubs. */
export function ClubFinderForm({ notFound }: { notFound?: boolean }) {
  return (
    <>
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
            placeholder="musikverein"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 focus:outline-none"
          />
          <span className="text-muted pr-3 text-sm">.{baseDomain().replace(/:\d+$/, "")}</span>
        </div>
        <Button className="w-full">Zur Anmeldung</Button>
      </form>
    </>
  );
}
