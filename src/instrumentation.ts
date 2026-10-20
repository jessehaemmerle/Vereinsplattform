export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { ensureDefaultAdmin } = await import("@/lib/bootstrap");
  try {
    await ensureDefaultAdmin();
  } catch (error) {
    console.error("[bootstrap] Standard-Admin konnte nicht angelegt werden", error);
  }
}
