import { redirect } from "next/navigation";
import { getCurrentUser, homeFor } from "@/lib/auth";
import { getTenant } from "@/lib/tenant";
import { ClubFinder } from "./club-finder";

export default async function Home({ searchParams }: { searchParams: Promise<{ "nicht-gefunden"?: string }> }) {
  const tenant = await getTenant();
  if (tenant.kind === "root") return <ClubFinder notFound={!!(await searchParams)["nicht-gefunden"]} />;
  if (tenant.kind === "admin") redirect("/admin");
  const user = await getCurrentUser();
  redirect(user ? homeFor(user) : "/login");
}
