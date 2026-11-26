import "server-only";
import type { Club } from "@prisma/client";
import { buildTheme, themeCss } from "@/lib/color";
import { fontVar } from "@/lib/font-options";
import { clubUrl } from "@/lib/hosts";
import type { MailBrand } from "@/lib/mail";

export const BRAND_ASSETS = {
  logo: "logoPath",
  "logo-dunkel": "logoDarkPath",
  favicon: "faviconPath",
  "login-bild": "loginImagePath",
} as const;
export type BrandAsset = keyof typeof BRAND_ASSETS;

/** Asset URL relative to the club's own host; the version suffix busts caches after an upload. */
export function assetUrl(club: Pick<Club, BrandAssetField>, asset: BrandAsset) {
  const path = club[BRAND_ASSETS[asset]];
  return path ? `/api/branding/${asset}?v=${path.slice(0, 8)}` : null;
}
type BrandAssetField = (typeof BRAND_ASSETS)[BrandAsset];

/** CSS that re-colours the whole UI and sets the brand font. Values are validated hex codes, so safe to inline. */
export function brandCss(club: Pick<Club, "primaryColor" | "accentColor" | "fontKey">) {
  return `${themeCss(buildTheme(club.primaryColor, club.accentColor))}:root{--font-brand:var(${fontVar(club.fontKey)})}`;
}

export function mailBrand(club: Club): MailBrand {
  const theme = buildTheme(club.primaryColor, club.accentColor);
  const logo = assetUrl(club, "logo");
  return {
    name: club.name,
    senderName: club.emailSenderName || club.name,
    color: theme.light["--loden"],
    logoUrl: logo ? clubUrl(club.slug, logo) : null,
    footer: club.emailFooter,
    replyTo: club.email,
  };
}
