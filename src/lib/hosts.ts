/**
 * Host <-> tenant mapping. Pure functions, usable in proxy, server code and tests.
 *   <BASE_DOMAIN>          root: club finder
 *   admin.<BASE_DOMAIN>    platform administration
 *   <slug>.<BASE_DOMAIN>   one club
 */
export const RESERVED_SLUGS = new Set(["admin", "www", "api", "app", "mail", "smtp", "static", "assets", "status", "help", "support", "login"]);
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export type HostKind = { kind: "root" } | { kind: "admin" } | { kind: "club"; slug: string } | { kind: "unknown" };

export function baseDomain() {
  return (process.env.BASE_DOMAIN ?? "localhost:3000")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

export function protocol() {
  const explicit = process.env.PUBLIC_PROTOCOL;
  if (explicit === "http" || explicit === "https") return explicit;
  return /^localhost(:\d+)?$|\.localhost(:\d+)?$/.test(baseDomain()) ? "http" : "https";
}

export function parseHost(rawHost: string | null | undefined, base = baseDomain()): HostKind {
  const host = (rawHost ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!host) return { kind: "unknown" };
  if (host === base) return { kind: "root" };
  const suffix = `.${base}`;
  if (!host.endsWith(suffix)) return { kind: "unknown" };
  const label = host.slice(0, -suffix.length);
  if (label === "admin") return { kind: "admin" };
  if (!SLUG_PATTERN.test(label) || RESERVED_SLUGS.has(label)) return { kind: "unknown" };
  return { kind: "club", slug: label };
}

export function isValidSlug(slug: string) {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function clubOrigin(slug: string) {
  return `${protocol()}://${slug}.${baseDomain()}`;
}

export function clubUrl(slug: string, path = "/") {
  return `${clubOrigin(slug)}${path}`;
}

export function adminUrl(path = "/admin") {
  return `${protocol()}://admin.${baseDomain()}${path}`;
}

export function rootUrl(path = "/") {
  return `${protocol()}://${baseDomain()}${path}`;
}

/** Hostname (without port) for cookies, iCal UIDs and similar. */
export function baseHostname() {
  return baseDomain().replace(/:\d+$/, "");
}

/**
 * The public host of a request. Next.js sets x-forwarded-host to the original host on every request and keeps it on its
 * internal re-render after a Server Action redirect (where Host is the internal address). Behind Caddy the header is
 * always overwritten with the real host, and the app container is not reachable directly.
 */
export function requestHost(headers: { get(name: string): string | null }) {
  return headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host");
}
