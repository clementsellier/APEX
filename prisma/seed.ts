// Données de démonstration, reprises des maquettes du PowerPoint.
// Lancer : npm run db:seed   (ou npx prisma migrate reset pour repartir de zéro)
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { existsSync, readFileSync } from "node:fs";
import { PrismaClient, type ActivityType } from "../src/generated/prisma/client";
import { applyUgaImport, parseUgaExcel, parseUgaGeoJson } from "../src/lib/uga/import";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Mot de passe commun à tous les comptes de démo (local uniquement).
const DEMO_PASSWORD = "apex-demo";

async function main() {
  // On vide dans l'ordre inverse des dépendances.
  await db.activity.deleteMany();
  await db.planEvent.deleteMany();
  await db.targetProduct.deleteMany();
  await db.target.deleteMany();
  await db.plan.deleteMany();
  await db.accountQualif.deleteMany();
  await db.address.deleteMany();
  await db.account.deleteMany();
  await db.brickKpi.deleteMany();
  await db.kpiDefinition.deleteMany();
  await db.brick.deleteMany();
  await db.product.deleteMany();
  await db.cycle.deleteMany();
  await db.user.updateMany({ data: { managerId: null } });
  await db.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const base = { passwordHash, team: "FRONCO", primaryRegion: "Est" };

  // ─── Utilisateurs (un par rôle) ───
  const hq = await db.user.create({
    data: {
      ...base,
      email: "hq@apex.local",
      firstName: "Hélène",
      lastName: "SIEGE",
      role: "HQ_USER",
    },
  });
  const admin = await db.user.create({
    data: {
      ...base,
      email: "admin@apex.local",
      firstName: "Admin",
      lastName: "APEX",
      role: "ADMIN",
    },
  });
  const teamManager = await db.user.create({
    data: {
      ...base,
      email: "team.manager@apex.local",
      firstName: "Julie",
      lastName: "MARTIN",
      role: "TEAM_MANAGER",
    },
  });
  const fieldManager = await db.user.create({
    data: {
      ...base,
      email: "manager@apex.local",
      firstName: "Paul",
      lastName: "BERNARD",
      role: "FIELD_MANAGER",
      managerId: teamManager.id,
    },
  });
  const arnaud = await db.user.create({
    data: {
      ...base,
      email: "arnaud@apex.local",
      firstName: "Arnaud",
      lastName: "DURAND",
      role: "FIELD_USER",
      primaryTerritory: "S105",
      managerId: fieldManager.id,
      crmId: "CRM-U-104",
    },
  });
  const emma = await db.user.create({
    data: {
      ...base,
      email: "emma@apex.local",
      firstName: "Emma",
      lastName: "LEROY",
      locale: "en",
      role: "FIELD_USER",
      primaryTerritory: "S104",
      managerId: fieldManager.id,
    },
  });
  void hq;
  void admin;

  // ─── Cycles ───
  const c1 = await db.cycle.create({
    data: {
      code: "26C1",
      label: "2026 – Cycle 1",
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-31"),
    },
  });
  const c2 = await db.cycle.create({
    data: {
      code: "26C2",
      label: "2026 – Cycle 2",
      startDate: new Date("2027-01-01"),
      endDate: new Date("2027-06-30"),
    },
  });

  // ─── Géographie et KPI ───
  // Référentiel UGA IQVIA : chargé depuis prisma/data/ s'il est présent (données sous licence,
  // non versionnées). Sinon, seules les UGA de la démo sont créées, sans contour.
  const geoFile = "prisma/data/uga.geojson";
  const listFile = "prisma/data/uga.xlsx";
  if (existsSync(geoFile) && existsSync(listFile)) {
    const shapes = parseUgaGeoJson(readFileSync(geoFile, "utf8"));
    const buffer = readFileSync(listFile);
    const rows = await parseUgaExcel(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
    );
    const count = await applyUgaImport(db, { rows, shapes });
    console.log(`Référentiel UGA importé : ${count} UGA`);
  } else {
    console.log("prisma/data/uga.geojson ou uga.xlsx absent : UGA de démo sans contour");
  }
  for (const [code, territory] of [
    ["25BES", "S105"],
    ["25MON", "S105"],
    ["25PON", "S105"],
    ["06NC1", "S104"],
  ]) {
    await db.brick.upsert({
      where: { code },
      create: { code, territory, department: code.slice(0, 2) },
      update: {},
    });
  }
  await db.kpiDefinition.createMany({
    data: [
      { key: "kpi1", label: "Ventes produit A", unit: "€" },
      { key: "kpi2", label: "Part de marché produit A", unit: "%" },
      { key: "kpi3", label: "Évolution ventes vs N-1", unit: "%" },
    ],
  });
  await db.brickKpi.createMany({
    data: [
      { brickCode: "25BES", kpiKey: "kpi1", value: 182000 },
      { brickCode: "25BES", kpiKey: "kpi2", value: 23.5 },
      { brickCode: "25BES", kpiKey: "kpi3", value: 4.2 },
      { brickCode: "25MON", kpiKey: "kpi1", value: 96000 },
      { brickCode: "25MON", kpiKey: "kpi2", value: 17.8 },
      { brickCode: "25MON", kpiKey: "kpi3", value: -1.5 },
      { brickCode: "25PON", kpiKey: "kpi1", value: 71000 },
      { brickCode: "25PON", kpiKey: "kpi2", value: 19.1 },
      { brickCode: "25PON", kpiKey: "kpi3", value: 2.0 },
    ],
  });

  const [prodA, prodB] = await Promise.all([
    db.product.create({ data: { name: "Produit A" } }),
    db.product.create({ data: { name: "Produit B" } }),
  ]);

  // ─── Comptes (PDS) ───
  type Seed = {
    title?: string;
    first?: string;
    last?: string;
    name?: string;
    type?: "HCP" | "PHARMACY";
    spe?: string;
    place: string;
    city: string;
    brick: string;
    lat: number;
    lng: number;
    qualifs?: [string, string, string][];
  };
  const P1: [string, string, string] = ["Potentiel", "P1", "#2E7D32"];
  const P2: [string, string, string] = ["Potentiel", "P2", "#F9A825"];
  const seeds: Seed[] = [
    {
      title: "Dr",
      first: "Aline",
      last: "VALOT",
      spe: "Cardiologue",
      place: "CH Besançon",
      city: "Besançon",
      brick: "25BES",
      lat: 47.2378,
      lng: 6.0241,
      qualifs: [P1, ["HTA", "HTA+", "#C62828"]],
    },
    {
      title: "Dr",
      first: "Marc",
      last: "VILLAIN",
      spe: "Médecine interne",
      place: "CH Besançon",
      city: "Besançon",
      brick: "25BES",
      lat: 47.238,
      lng: 6.0245,
      qualifs: [P2, ["HTA", "HTA+", "#C62828"]],
    },
    {
      title: "Pr",
      first: "Pierre",
      last: "TRUCHE",
      spe: "Cardiologue",
      place: "CH Besançon",
      city: "Besançon",
      brick: "25BES",
      lat: 47.2375,
      lng: 6.0238,
      qualifs: [P1],
    },
    {
      title: "Dr",
      first: "Guillaume",
      last: "DUMONT",
      spe: "Cardiologue",
      place: "CH Besançon",
      city: "Besançon",
      brick: "25BES",
      lat: 47.2382,
      lng: 6.025,
      qualifs: [P1, ["HTA", "HTA+", "#C62828"]],
    },
    {
      title: "Dr",
      first: "Stefan",
      last: "THOMAS",
      spe: "Cardiologue",
      place: "CH Besançon",
      city: "Besançon",
      brick: "25BES",
      lat: 47.2371,
      lng: 6.0233,
      qualifs: [P1, ["Dyslipidémie", "DYS++", "#6A1B9A"]],
    },
    {
      title: "Dr",
      first: "Sophie",
      last: "TROUBLOU",
      spe: "Cardiologue",
      place: "Cabinet TROUBLOU",
      city: "Montbéliard",
      brick: "25MON",
      lat: 47.5097,
      lng: 6.7983,
      qualifs: [P2],
    },
    {
      title: "Dr",
      first: "Sohan",
      last: "THINH",
      spe: "Néphrologue",
      place: "Clinique 3 Soleils",
      city: "Montbéliard",
      brick: "25MON",
      lat: 47.5112,
      lng: 6.7951,
      qualifs: [P1],
    },
    {
      title: "Dr",
      first: "Hélène",
      last: "RITCHIE",
      spe: "Médecin généraliste",
      place: "Clinique 3 Soleils",
      city: "Montbéliard",
      brick: "25MON",
      lat: 47.5081,
      lng: 6.8012,
    },
    {
      title: "Dr",
      first: "Lucas",
      last: "PERRIN",
      spe: "Cardiologue",
      place: "Cabinet Perrin",
      city: "Pontarlier",
      brick: "25PON",
      lat: 46.9047,
      lng: 6.3547,
      qualifs: [P2],
    },
    {
      type: "PHARMACY",
      name: "Pharmacie du Centre",
      place: "Pharmacie du Centre",
      city: "Besançon",
      brick: "25BES",
      lat: 47.24,
      lng: 6.022,
    },
    {
      type: "PHARMACY",
      name: "Pharmacie des Cordeliers",
      place: "Pharmacie des Cordeliers",
      city: "Montbéliard",
      brick: "25MON",
      lat: 47.5104,
      lng: 6.8031,
    },
  ];

  const accounts: Record<string, string> = {};
  for (const [i, s] of seeds.entries()) {
    const type = s.type ?? "HCP";
    const name = s.name ?? `${s.title} ${s.first} ${s.last}`;
    const acc = await db.account.create({
      data: {
        crmId: `CRM-A-${1000 + i}`,
        type,
        title: s.title,
        firstName: s.first,
        lastName: s.last,
        name,
        specialty: s.spe,
        workplace: s.place,
        brickCode: s.brick,
        addresses: { create: { line1: s.place, city: s.city, latitude: s.lat, longitude: s.lng } },
        qualifs: {
          create: (s.qualifs ?? []).map(([label, value, color]) => ({
            team: "FRONCO",
            label,
            value,
            color,
          })),
        },
      },
    });
    accounts[s.last ?? name] = acc.id;
  }

  // ─── Plans : cycle en cours (actif) et cycle suivant (en création) ───
  const goals: [string, number, number, number][] = [
    ["VALOT", 5, 2, 1],
    ["VILLAIN", 3, 1, 1],
    ["TRUCHE", 2, 1, 0],
    ["TROUBLOU", 2, 3, 0],
    ["THINH", 4, 3, 1],
    ["RITCHIE", 0, 4, 0],
  ];
  const current = await db.plan.create({
    data: {
      name: "26C1-FRONCO-S105",
      territory: "S105",
      status: "ACTIVE",
      ownerId: arnaud.id,
      cycleId: c1.id,
      crmId: "CRM-P-26C1-104",
      targets: {
        create: goals.map(([last, call, evt, mail]) => ({
          accountId: accounts[last],
          goalCall: call,
          goalEvtAtt: evt,
          goalAemail: mail,
          products: { create: [{ productId: prodA.id, goalCall: call, goalAemail: mail }] },
        })),
      },
      events: {
        create: [{ actorId: fieldManager.id, action: "VALIDATED", comment: "OK pour le cycle 1" }],
      },
    },
  });
  await db.plan.create({
    data: {
      name: "26C2-FRONCO-S105",
      territory: "S105",
      status: "IN_CREATION",
      ownerId: arnaud.id,
      cycleId: c2.id,
      targets: {
        create: goals.slice(0, 4).map(([last, call, evt, mail]) => ({
          accountId: accounts[last],
          goalCall: call,
          goalEvtAtt: evt,
          goalAemail: mail,
          products: { create: [{ productId: prodB.id, goalCall: 1, goalAemail: 0 }] },
        })),
      },
      events: {
        create: [{ actorId: arnaud.id, action: "CREATED", comment: `Copié de ${current.name}` }],
      },
    },
  });

  // ─── Plan d'Emma (secteur 105), envoyé en validation : à examiner par le manager ───
  const emmaAccounts = await Promise.all(
    [
      ["Dr Claire FAIVRE", "Claire", "FAIVRE", "Cardiologue", "CHU de Nice"],
      ["Dr Nicolas GIRARDOT", "Nicolas", "GIRARDOT", "Néphrologue", "CHU de Nice"],
      ["Dr Inès MOREL", "Inès", "MOREL", "Médecin généraliste", "Cabinet Morel"],
    ].map(([name, first, last, spe, place], i) =>
      db.account.create({
        data: {
          crmId: `CRM-A-${2000 + i}`,
          type: "HCP",
          title: "Dr",
          firstName: first,
          lastName: last,
          name,
          specialty: spe,
          workplace: place,
          brickCode: "06NC1",
          addresses: {
            create: { line1: place, city: "Nice", latitude: 43.7102, longitude: 7.262 },
          },
        },
      }),
    ),
  );
  await db.plan.create({
    data: {
      name: "26C2-FRONCO-S104",
      territory: "S104",
      status: "IN_VALIDATION",
      ownerId: emma.id,
      cycleId: c2.id,
      targets: {
        create: emmaAccounts.map((a, i) => ({
          accountId: a.id,
          goalCall: [4, 3, 2][i],
          goalEvtAtt: [2, 1, 1][i],
          goalAemail: [1, 2, 0][i],
        })),
      },
      events: {
        create: [
          { actorId: emma.id, action: "CREATED", createdAt: new Date("2026-11-20T09:00:00Z") },
          {
            actorId: emma.id,
            action: "SUBMITTED",
            comment: "Focus sur le CHU de Nice pour le lancement du produit B.",
            createdAt: new Date("2026-11-24T16:30:00Z"),
          },
        ],
      },
    },
  });

  // ─── Activité réalisée sur le cycle 1 (pour les stats "last cycle") ───
  const done: [string, ActivityType, string][] = [
    ["VALOT", "CALL", "2026-07-08"],
    ["VALOT", "CALL", "2026-09-15"],
    ["VALOT", "CALL", "2026-11-03"],
    ["VALOT", "EVT_ATT", "2026-10-12"],
    ["VALOT", "AEMAIL", "2026-08-20"],
    ["DUMONT", "CALL", "2026-07-21"],
    ["DUMONT", "CALL", "2026-10-02"],
    ["DUMONT", "EVT_ATT", "2026-10-12"],
    ["THOMAS", "CALL", "2026-09-30"],
    ["THOMAS", "EVT_ATT", "2026-10-12"],
    ["THINH", "CALL", "2026-07-15"],
    ["THINH", "CALL", "2026-09-10"],
    ["THINH", "AEMAIL", "2026-11-05"],
    ["TROUBLOU", "CALL", "2026-08-28"],
    ["RITCHIE", "EVT_ATT", "2026-10-12"],
  ];
  await db.activity.createMany({
    data: done.map(([last, type, date]) => ({
      type,
      date: new Date(date),
      accountId: accounts[last],
      userId: arnaud.id,
    })),
  });

  const counts = {
    users: await db.user.count(),
    accounts: await db.account.count(),
    plans: await db.plan.count(),
    targets: await db.target.count(),
    activities: await db.activity.count(),
  };
  console.log("Seed terminé :", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
