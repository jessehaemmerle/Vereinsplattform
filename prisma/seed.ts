/* Demo data: npm run db:seed  (only for development / demos) */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("demo-passwort-123", 12);
  const year = new Date().getFullYear();
  const soon = (days: number, hour: number) => {
    const d = new Date(Date.now() + days * 86_400_000);
    d.setUTCHours(hour - 2, 0, 0, 0);
    return d;
  };
  await db.club.deleteMany({ where: { OR: [{ slug: "musikverein-gruenbach" }, { name: "Musikverein Grünbach" }] } });
  await db.license.deleteMany({ where: { key: "VP-DEMO-DEMO-DEMO-DEMO" } });
  await db.user.deleteMany({ where: { email: { in: ["obfrau@demo.at", "kassier@demo.at", "mitglied@demo.at"] } } });

  const plans = [
    {
      name: "Basis",
      description: "Für kleine Vereine",
      priceCents: 9900,
      publicListed: true,
      highlighted: false,
      sortOrder: 1,
      maxMembers: 100,
      maxUsers: 3,
      durationMonths: 12,
      modules: ["MITGLIEDER", "FINANZEN", "EVENTS", "DOKUMENTE"] as const,
    },
    {
      name: "Plus",
      description: "Alle Module, auch Rundschreiben",
      priceCents: 19900,
      publicListed: true,
      highlighted: true,
      sortOrder: 2,
      maxMembers: 300,
      maxUsers: 10,
      durationMonths: 12,
      modules: ["MITGLIEDER", "FINANZEN", "EVENTS", "NOTIZEN", "DOKUMENTE", "KOMMUNIKATION"] as const,
    },
    {
      name: "Premium",
      description: "Für Dachverbände und große Vereine",
      priceCents: null,
      publicListed: true,
      highlighted: false,
      sortOrder: 3,
      maxMembers: null,
      maxUsers: null,
      durationMonths: 12,
      modules: ["MITGLIEDER", "FINANZEN", "EVENTS", "NOTIZEN", "DOKUMENTE", "KOMMUNIKATION"] as const,
    },
  ];
  for (const p of plans)
    await db.licensePlan.upsert({ where: { name: p.name }, update: { ...p, modules: [...p.modules] }, create: { ...p, modules: [...p.modules] } });
  const plus = await db.licensePlan.findUniqueOrThrow({ where: { name: "Plus" } });

  const club = await db.club.create({
    data: {
      name: "Musikverein Grünbach",
      slug: "musikverein-gruenbach",
      primaryColor: "#7a1f2b",
      accentColor: "#b8860b",
      fontKey: "literata",
      loginTitle: "Willkommen beim Musikverein Grünbach",
      loginText: "Proben, Auftritte und Beiträge – alles an einem Ort.",
      emailFooter: "Musikverein Grünbach · Hauptplatz 1 · 4264 Grünbach",
      email: "obfrau@demo.at",
      address: "Hauptplatz 1, 4264 Grünbach",
      iban: "AT611904300234573201",
      bankName: "Raiffeisenbank Grünbach",
      bic: "RZOOAT2L",
      taxMode: "NICHT_STEUERBAR",
      invoiceFooter: "ZVR-Zahl 123456789",
      openingBalance: 1250,
    },
  });
  const until = new Date(Date.now() + 20 * 86_400_000);
  const license = await db.license.create({
    data: {
      key: "VP-DEMO-DEMO-DEMO-DEMO",
      name: "Plus – Musikverein Grünbach",
      planId: plus.id,
      status: "ACTIVE",
      maxMembers: 300,
      maxUsers: 10,
      clubId: club.id,
      validUntil: new Date(until.toISOString().slice(0, 10)),
    },
  });
  await db.licenseEvent.create({ data: { licenseId: license.id, action: "erstellt", detail: "Demo-Daten" } });

  // second club to demonstrate tenant isolation and a different look
  await db.club.deleteMany({ where: { OR: [{ slug: "sportunion-tal" }, { name: "Sportunion Tal" }, { previousSlug: "sportunion-tal" }] } });
  await db.user.deleteMany({ where: { email: "obmann@demo.at" } });
  const second = await db.club.create({
    data: {
      name: "Sportunion Tal",
      slug: "sportunion-tal",
      primaryColor: "#0b5cad",
      accentColor: "#e07a00",
      fontKey: "lexend",
      users: { create: { email: "obmann@demo.at", name: "Otto Obmann", passwordHash: password, role: "ADMIN" } },
    },
  });
  await db.license.deleteMany({ where: { key: "VP-DEMO-SPORT-UNIO-NTAL" } });
  await db.license.create({
    data: { key: "VP-DEMO-SPORT-UNIO-NTAL", name: "Basis – Sportunion Tal", status: "TRIAL", maxMembers: 100, maxUsers: 3, clubId: second.id },
  });
  const athletes = [
    ["Sarah", "Sprinter", "Leichtathletik"],
    ["Jonas", "Huber", "Fußball"],
    ["Mira", "Kogler", "Turnen"],
    ["Felix", "Brandl", "Fußball"],
    ["Emma", "Riegler", "Volleyball"],
    ["Paul", "Eder", "Tischtennis"],
    ["Lea", "Mayr", "Turnen"],
    ["Tobias", "Wimmer", "Fußball"],
  ] as const;
  for (const [i, [first, last, section]] of athletes.entries()) {
    const fee = i % 4 === 0 ? 0 : 60;
    const paid = i % 3 !== 1 && fee > 0;
    const m = await db.member.create({
      data: {
        clubId: second.id,
        firstName: first,
        lastName: last,
        email: `${first}.${last}@demo.at`.toLowerCase(),
        function: section,
        fee,
        feePaidYear: paid ? year : null,
        birthday: new Date(Date.UTC(1995 + i, (new Date().getMonth() + i + 1) % 12, 3 + i)),
        joinedAt: new Date(Date.UTC(2015 + i, 8, 1)),
      },
    });
    if (paid)
      await db.transaction.create({
        data: {
          clubId: second.id,
          memberId: m.id,
          feeYear: year,
          type: "EINNAHME",
          category: "Mitgliedsbeitrag",
          amount: fee,
          date: new Date(Date.UTC(year, 2, 1 + i)),
          description: `Beitrag ${year} – ${first} ${last}`,
        },
      });
  }
  await db.club.update({ where: { id: second.id }, data: { openingBalance: 3420 } });
  await db.transaction.createMany({
    data: [
      {
        clubId: second.id,
        type: "EINNAHME",
        category: "Sponsoring",
        amount: 1200,
        date: new Date(Date.UTC(year, 1, 12)),
        description: "Trikotsponsor Autohaus Tal",
      },
      { clubId: second.id, type: "AUSGABE", category: "Material", amount: 645.8, date: new Date(Date.UTC(year, 3, 8)), description: "Bälle und Netze" },
      { clubId: second.id, type: "EINNAHME", category: "Veranstaltung", amount: 1980, date: new Date(Date.UTC(year, 5, 22)), description: "Sommerturnier" },
    ],
  });
  await db.event.createMany({
    data: [
      { clubId: second.id, title: "Training U12", location: "Sportplatz Tal", startsAt: soon(2, 17) },
      { clubId: second.id, title: "Heimspiel gegen SV Berg", location: "Sportplatz Tal", startsAt: soon(6, 15) },
      { clubId: second.id, title: "Weihnachtsfeier", location: "Vereinsheim", startsAt: soon(24, 18) },
    ],
  });
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
  await db.contact.create({ data: { clubId: club.id, name: "Marktgemeinde Grünbach", address: "Marktplatz 1\n4264 Grünbach", email: "gemeinde@demo.at" } });
  await db.contact.create({
    data: { clubId: club.id, name: "Raiffeisenbank Grünbach", address: "Hauptstraße 5\n4264 Grünbach", email: "sponsoring@demo.at", vatId: "ATU12345678" },
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
  console.log(
    "Demo-Vereine angelegt (Passwort demo-passwort-123):\n  musikverein-gruenbach: obfrau@demo.at, kassier@demo.at, mitglied@demo.at\n  sportunion-tal: obmann@demo.at",
  );
}

main().finally(() => db.$disconnect());
