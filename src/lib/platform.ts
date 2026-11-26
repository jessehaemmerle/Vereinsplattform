/** Public name of the platform (landing page, "powered by", e-mails). Set PLATFORM_NAME in .env. */
export function platformName() {
  return process.env.PLATFORM_NAME?.trim() || "Vereinsplattform";
}
