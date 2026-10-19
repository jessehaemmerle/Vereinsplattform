const eur = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });
const dateFmt = new Intl.DateTimeFormat("de-AT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Vienna" });
const dateTimeFmt = new Intl.DateTimeFormat("de-AT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Vienna",
});

type Num = number | string | { toString(): string } | null | undefined;

export function toNumber(value: Num): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value.toString());
}

export function formatEur(value: Num) {
  return eur.format(toNumber(value));
}

export function formatDate(value: Date | null | undefined) {
  return value ? dateFmt.format(value) : "–";
}

export function formatDateTime(value: Date | null | undefined) {
  return value ? dateTimeFmt.format(value) : "–";
}

/** yyyy-mm-dd for <input type="date"> */
export function toDateInput(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

/** yyyy-mm-ddThh:mm in Vienna local time for <input type="datetime-local"> */
export function toDateTimeInput(value: Date | null | undefined) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Vienna",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
  return parts.replace(" ", "T");
}

/** Interprets a datetime-local value as Europe/Vienna time. */
export function fromDateTimeInput(value: string): Date {
  const naive = new Date(`${value}:00Z`);
  // second pass uses the offset valid at the actual instant (correct around DST changes)
  const first = new Date(naive.getTime() - viennaOffsetMinutes(naive) * 60_000);
  return new Date(naive.getTime() - viennaOffsetMinutes(first) * 60_000);
}

/** Calendar date in Vienna as yyyy-mm-dd. */
export function viennaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vienna", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Vienna calendar date as a UTC-midnight Date (how @db.Date values are stored). */
export function viennaDay(date = new Date()) {
  return new Date(`${viennaDateString(date)}T00:00:00Z`);
}

export function viennaYear(date = new Date()) {
  return Number(viennaDateString(date).slice(0, 4));
}

function viennaOffsetMinutes(date: Date) {
  const local = new Date(date.toLocaleString("en-US", { timeZone: "Europe/Vienna" }));
  const utc = new Date(date.toLocaleString("en-US", { timeZone: "UTC" }));
  return Math.round((local.getTime() - utc.getTime()) / 60_000);
}

export function ageOn(birthday: Date, on = viennaDay()) {
  let age = on.getUTCFullYear() - birthday.getUTCFullYear();
  const m = on.getUTCMonth() - birthday.getUTCMonth();
  if (m < 0 || (m === 0 && on.getUTCDate() < birthday.getUTCDate())) age--;
  return age;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
