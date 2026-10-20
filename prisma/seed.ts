/* Demo data: npm run db:seed  (only for development / demos) */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("demo-passwort-123", 12);
  const existing = await db.club.findUnique({ where: { slug: "musikverein-gruenbach" } });
  if (existing) await db.club.delete({ where: { id: existing.id } });
  await db.license.deleteMany({ where: { key: "VP-DEMO-DEMO-DEMO-DEMO" } });
  await db.user.deleteMany({ where: { email: { in: ["obfrau@demo.at", "kassier@demo.at", "mitglied@demo.at"] } } });

  const club = await db.club.create({
    data: {
      name: "Musikverein Grünbach",
      slug: "musikverein-gruenbach",
      email: "obfrau@demo.at",
      address: "Hauptplatz 1, 4264 Grünbach",
      iban: "AT611904300234573201",
      bankName: "Raiffeisenbank Grünbach",
      openingBalance: 1250,
    },
  });
  await db.license.create({ data: { key: "VP-DEMO-DEMO-DEMO-DEMO", name: "Demo", status: "TRIAL", maxMembers: 200, maxUsers: 10, clubId: club.id } });
  await db.user.createMany({
    data: [
      { email: "obfrau@demo.at", name: "Maria Huber", passwordHash: password, role: "ADMIN", clubId: club.id },
      { email: "kassier@demo.at", name: "Franz Leitner", passwordHash: password, role: "KASSIER", clubId: club.id },
    ],
  });

  const people = [
    ["Maria", "Huber", "Obfrau", 40],
    ["Franz", "Leitner", "Kassier", 40],
    ["Anna", "Gruber", "Schriftführerin", 40],
    ["Josef", "Pichler", "Kapellmeister", 0],
    ["Lena", "Wagner", "Klarinette", 25],
    ["Lukas", "Moser", "Trompete", 25],
    ["Sophie", "Bauer", "Querflöte", 25],
    ["Michael", "Hofer", "Tuba", 40],
    ["Julia", "Steiner", "Saxophon", 25],
    ["Thomas", "Berger", "Schlagwerk", 40],
  ] as const;
  const year = new Date().getFullYear();
  for (const [i, [first, last, fn, fee]] of people.entries()) {
    const email = i === 4 ? "mitglied@demo.at" : i < 2 ? (i === 0 ? "obfrau@demo.at" : "kassier@demo.at") : `${first}.${last}@demo.at`.toLowerCase();
    const paid = i % 3 !== 0 && fee > 0;
    const member = await db.member.create({
      data: {
        clubId: club.id,
        firstName: first,
        lastName: last,
        email,
        function: fn,
        fee,
        status: i === 3 ? "EHRENMITGLIED" : i === 9 ? "PASSIV" : "AKTIV",
        joinedAt: new Date(Date.UTC(2010 + i, 2, 1)),
        birthday: new Date(Date.UTC(1965 + i * 3, (new Date().getMonth() + i) % 12, 5 + i)),
        city: "Grünbach",
        zip: "4264",
        street: `Dorfstraße ${i + 3}`,
        phone: `0664 55${String(i).padStart(4, "0")}`,
        feePaidYear: paid ? year : null,
      },
    });
    if (paid) {
      await db.transaction.create({
        data: {
          clubId: club.id,
          memberId: member.id,
          feeYear: year,
          type: "EINNAHME",
          category: "Mitgliedsbeitrag",
          amount: fee,
          date: new Date(Date.UTC(year, 1, 1 + i)),
          description: `Beitrag ${year} – ${first} ${last}`,
        },
      });
    }
  }
  const users = await db.user.findMany({ where: { clubId: club.id } });
  for (const u of users) await db.member.updateMany({ where: { clubId: club.id, email: u.email }, data: { userId: u.id } });
  const memberUser = await db.user.create({
    data: { email: "mitglied@demo.at", name: "Lena Wagner", passwordHash: password, role: "MITGLIED", clubId: club.id },
  });
  await db.member.updateMany({ where: { clubId: club.id, email: "mitglied@demo.at" }, data: { userId: memberUser.id } });

  await db.transaction.createMany({
    data: [
      { clubId: club.id, type: "EINNAHME", category: "Förderung", amount: 1500, date: new Date(Date.UTC(year, 2, 10)), description: "Kulturförderung Land OÖ" },
      {
        clubId: club.id,
        type: "AUSGABE",
        category: "Material",
        amount: 389.9,
        date: new Date(Date.UTC(year, 3, 2)),
        description: "Notenmaterial Frühjahrskonzert",
      },
      {
        clubId: club.id,
        type: "AUSGABE",
        category: "Versicherung",
        amount: 214.5,
        date: new Date(Date.UTC(year, 0, 15)),
        description: "Instrumentenversicherung",
      },
      {
        clubId: club.id,
        type: "EINNAHME",
        category: "Veranstaltung",
        amount: 2840,
        date: new Date(Date.UTC(year, 4, 20)),
        description: "Frühjahrskonzert Eintritt und Buffet",
      },
      { clubId: club.id, type: "EINNAHME", category: "Spende", amount: 300, date: new Date(Date.UTC(year - 1, 10, 3)), description: "Spende Raiffeisenbank" },
      { clubId: club.id, type: "AUSGABE", category: "Miete", amount: 600, date: new Date(Date.UTC(year - 1, 11, 1)), description: "Probelokal 2. Halbjahr" },
    ],
  });
  const soon = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * 86_400_000);
    d.setUTCHours(hour - 2, 0, 0, 0);
    return d;
  };
  const concert = await db.event.create({
    data: {
      clubId: club.id,
      title: "Herbstkonzert",
      description: "Mit Gastkapelle aus Freistadt.",
      location: "Turnsaal Volksschule",
      startsAt: soon(12, 19),
      cost: 450,
    },
  });
  await db.transaction.create({
    data: {
      clubId: club.id,
      eventId: concert.id,
      type: "AUSGABE",
      category: "Eventkosten",
      amount: 450,
      date: new Date(concert.startsAt.toISOString().slice(0, 10)),
      description: "Kosten für Termin: Herbstkonzert",
    },
  });
  await db.event.createMany({
    data: [
      { clubId: club.id, title: "Gesamtprobe", location: "Probelokal", startsAt: soon(3, 20) },
      { clubId: club.id, title: "Vorstandssitzung", location: "Gasthaus Lindner", startsAt: soon(8, 19), public: false },
      { clubId: club.id, title: "Jahreshauptversammlung", description: "Tagesordnung folgt per E-Mail.", location: "Gasthaus Lindner", startsAt: soon(40, 19) },
    ],
  });
  await db.note.create({
    data: {
      clubId: club.id,
      title: "Vorstandssitzung März",
      content: "– Neue Uniformen: Angebote einholen (Anna)\n– Jugendförderung beantragen (Franz)\n– Termin Frühjahrskonzert fixiert",
      pinned: true,
    },
  });
  await db.emailTemplate.create({
    data: {
      clubId: club.id,
      name: "Zahlungserinnerung",
      subject: "Mitgliedsbeitrag {{verein}}",
      body: "Hallo {{vorname}},\n\nbitte denk an deinen Mitgliedsbeitrag von {{beitrag}}.\nIBAN: {{iban}}\n\nDanke und liebe Grüße\nDer Vorstand",
    },
  });
  console.log("Demo-Verein angelegt. Logins (Passwort demo-passwort-123): obfrau@demo.at, kassier@demo.at, mitglied@demo.at");
}

main().finally(() => db.$disconnect());
