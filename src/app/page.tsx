import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";
import { platformName } from "@/lib/platform";
import { Landing } from "@/components/public/landing";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  if (tenant.kind !== "root") return {};
  const name = platformName();
  const description =
    "Mitglieder, Beiträge, Kassabuch und Termine für Vereine – mit eigener Adresse und eigenem Erscheinungsbild. Server in der EU, DSGVO-konform.";
  return {
    title: { absolute: `${name} – Vereinsverwaltung für Obleute, Kassiere und Schriftführer` },
    description,
    openGraph: { title: name, description, images: ["/landing/dashboard-musikverein.webp"], locale: "de_AT", type: "website" },
    robots: { index: true },
  };
}

export default async function Home({ searchParams }: { searchParams: Promise<{ "nicht-gefunden"?: string; paket?: string }> }) {
  const tenant = await getTenant();
  if (tenant.kind === "root") {
    const sp = await searchParams;
    return <Landing notFound={!!sp["nicht-gefunden"]} planId={sp.paket} />;
  }
  if (tenant.kind === "admin") redirect("/admin");
  const user = await getCurrentUser();
  redirect(user ? homeFor(user) : "/login");
}
