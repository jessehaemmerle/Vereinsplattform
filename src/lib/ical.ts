type IcalEvent = { id: string; title: string; description: string | null; location: string | null; startsAt: Date; endsAt: Date | null; createdAt: Date };

function stamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

function escape(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/[,;]/g, (c) => `\\${c}`);
}

/** RFC 5545 line folding at 75 octets. */
function fold(line: string) {
  const out: string[] = [];
  let current = "";
  for (const char of line) {
    if (Buffer.byteLength(current + char) > 75) {
      out.push(current);
      current = " " + char;
    } else current += char;
  }
  out.push(current);
  return out.join("\r\n");
}

export function buildCalendar(name: string, events: IcalEvent[], host = "vereinsplattform") {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Vereinsplattform//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escape(name)}`,
    "X-WR-TIMEZONE:Europe/Vienna",
  ];
  for (const e of events) {
    const end = e.endsAt ?? new Date(e.startsAt.getTime() + 2 * 3_600_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@${host}`,
      `DTSTAMP:${stamp(e.createdAt)}`,
      `DTSTART:${stamp(e.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(e.title)}`,
    );
    if (e.location) lines.push(`LOCATION:${escape(e.location)}`);
    if (e.description) lines.push(`DESCRIPTION:${escape(e.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
