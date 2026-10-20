import { db } from "@/lib/db";

export async function txFormData(clubId: string) {
  const [members, cats] = await Promise.all([
    db.member.findMany({ where: { clubId }, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
    db.transaction.findMany({ where: { clubId }, distinct: ["category"], select: { category: true } }),
  ]);
  return { members: members.map((m) => ({ id: m.id, name: `${m.lastName} ${m.firstName}` })), usedCategories: cats.map((c) => c.category) };
}
