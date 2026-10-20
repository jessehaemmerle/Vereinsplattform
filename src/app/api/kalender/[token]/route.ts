import { db } from "@/lib/db";
import { buildCalendar } from "@/lib/ical";

export async function GET(_: Request, ctx: { params: Promise<{ token: string }> }) {
  const token = (await ctx.params).token.replace(/\.ics$/, "");
  const club = await db.club.findUnique({ where: { calendarToken: token } });
  if (!club || !club.modules.includes("EVENTS")) return new Response("Nicht gefunden", { status: 404 });
  const events = await db.event.findMany({
    where: { clubId: club.id, public: true, startsAt: { gte: new Date(Date.now() - 365 * 86_400_000) } },
    orderBy: { startsAt: "asc" },
  });
  return new Response(buildCalendar(club.name, events, new URL(process.env.APP_URL ?? "http://localhost").hostname), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
  });
}
