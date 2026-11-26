import { db } from "@/lib/db";
import { buildCalendar } from "@/lib/ical";
import { getTenant } from "@/lib/tenant";
import { baseHostname } from "@/lib/hosts";

export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.replace(/\.ics$/, "");
  const club = await db.club.findUnique({ where: { calendarToken: token } });
  const tenant = await getTenant();
  // a feed is only served on its own club's host
  if (!club || tenant.kind !== "club" || tenant.club?.id !== club.id || !club.modules.includes("EVENTS"))
    return new Response("Nicht gefunden", { status: 404 });
  const events = await db.event.findMany({
    where: { clubId: club.id, public: true, startsAt: { gte: new Date(Date.now() - 365 * 86_400_000) } },
    orderBy: { startsAt: "asc" },
  });
  return new Response(buildCalendar(club.name, events, `${club.slug}.${baseHostname()}`), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
  });
}
