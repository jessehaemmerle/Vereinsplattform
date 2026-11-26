import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { baseDomain, clubUrl, parseHost, protocol, requestHost } from "@/lib/hosts";
import { tenantCache, type TenantLookup } from "@/lib/tenant-cache";

/**
 * Routing by host. Authorization is NOT done here (server code checks tenant and permissions itself);
 * the proxy only sends requests to the right place:
 *  - unknown club subdomains → 404, renamed ones → redirect to the new subdomain (90 days)
 *  - platform pages only on admin.<domain>, club pages only on <club>.<domain>
 */
const ALWAYS = /^\/(api\/health|api\/tls-check)(\/|$)/;
const SHARED = /^\/(login|passwort|passwort-vergessen|sicherheit|api\/branding)(\/|$)/;
/** Public pages on the bare domain: landing page, legal pages and their static images. */
const ROOT_PAGES = /^\/(|impressum|datenschutz|nutzungsbedingungen|auftragsverarbeitung|nicht-gefunden)$|^\/landing\//;
const GRACE_MS = 90 * 86_400_000;

type Lookup = TenantLookup;

async function lookup(slug: string): Promise<Lookup> {
  const cache = tenantCache();
  const hit = cache.get(slug);
  if (hit && Date.now() - hit.at < 30_000) return hit;
  const club = await db.club.findUnique({ where: { slug }, select: { id: true } });
  let result: Lookup = { exists: !!club, at: Date.now() };
  if (!club) {
    const renamed = await db.club.findUnique({ where: { previousSlug: slug }, select: { slug: true, slugChangedAt: true } });
    if (renamed?.slugChangedAt && Date.now() - renamed.slugChangedAt.getTime() < GRACE_MS) result = { exists: false, redirectTo: renamed.slug, at: Date.now() };
  }
  if (cache.size > 5000) cache.clear();
  cache.set(slug, result);
  return result;
}

/**
 * Content-Security-Policy with a fresh nonce per request (Next.js applies it to its own scripts).
 * Styles allow 'unsafe-inline' because React style attributes cannot carry a nonce; scripts do not.
 */
function csp(nonce: string) {
  const https = protocol() === "https";
  const dev = process.env.NODE_ENV === "development";
  const ownHosts = `${protocol()}://${baseDomain()} ${protocol()}://*.${baseDomain()}`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${ownHosts}`,
    "frame-ancestors 'none'",
    ...(https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function withNonce(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = csp(nonce);
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  return { headers, policy };
}

function pass(req: NextRequest) {
  const { headers, policy } = withNonce(req);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", policy);
  return res;
}

function notFound(req: NextRequest) {
  const { headers, policy } = withNonce(req);
  const res = NextResponse.rewrite(new URL("/nicht-gefunden", req.url), { status: 404, request: { headers } });
  res.headers.set("Content-Security-Policy", policy);
  return res;
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (ALWAYS.test(pathname)) return NextResponse.next();
  const rawHost = requestHost(req.headers);
  const host = parseHost(rawHost);
  // redirects use the public host, never the internal address in req.url
  const here = (path: string) => `${protocol()}://${rawHost}${path}`;

  switch (host.kind) {
    case "club": {
      const club = await lookup(host.slug);
      if (club.redirectTo) return NextResponse.redirect(clubUrl(club.redirectTo, pathname + search), 308);
      if (!club.exists) return notFound(req);
      if (pathname.startsWith("/admin")) return notFound(req);
      return pass(req);
    }
    case "admin": {
      if (pathname === "/") return NextResponse.redirect(here("/admin"));
      if (pathname.startsWith("/admin") || SHARED.test(pathname) || pathname === "/nicht-gefunden") return pass(req);
      return NextResponse.redirect(here("/admin"));
    }
    case "root":
      return ROOT_PAGES.test(pathname) ? pass(req) : NextResponse.redirect(here("/"));
    default:
      return notFound(req);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
