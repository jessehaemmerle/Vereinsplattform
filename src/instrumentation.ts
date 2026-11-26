export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDefaultAdmin } = await import("@/lib/bootstrap");
  try {
    await ensureDefaultAdmin();
  } catch (error) {
    console.error("[bootstrap] Standard-Admin konnte nicht angelegt werden", error);
  }

  // License expiry reminders: shortly after start, then every 6 hours (idempotent, so restarts are harmless).
  if (process.env.LICENSE_REMINDERS !== "off") {
    const { sendLicenseReminders } = await import("@/lib/reminders");
    const run = () =>
      sendLicenseReminders()
        .then((n) => n && console.info(`[reminders] ${n} Lizenz-Erinnerungen versendet`))
        .catch((e) => console.error("[reminders] fehlgeschlagen", e));
    setTimeout(run, 60_000).unref();
    setInterval(run, 6 * 3_600_000).unref();
  }
}
