/**
 * Seeds 10 tennis courts in the Burbank / Los Angeles area.
 * Run with: npm run db:seed-courts
 *
 * NOTE: This project uses Drizzle ORM, not Prisma.
 * Coordinates are hardcoded approximations — use the admin UI to refine them.
 */
import { db } from "./db";
import { courts } from "@shared/models/tennis";

const COURTS = [
  {
    name: "Verdugo Park Tennis Courts",
    address: "3201 W Verdugo Ave, Burbank, CA 91505",
    latitude: 34.1754,
    longitude: -118.3377,
    courtType: "PUBLIC_FREE" as const,
    cost: "Free",
    bookingMethod: "First-come, first-served",
    numberOfCourts: 6,
    surface: "Hard",
    hasLights: true,
    hasRestrooms: true,
    hours: "Dawn to dusk (lit until 10pm)",
    netCondition: "GOOD" as const,
    juniorNotes: "Popular with juniors on weekday afternoons. Six well-maintained courts with lights.",
  },
  {
    name: "Brace Canyon Park",
    address: "3200 E Brace Canyon Rd, Burbank, CA 91504",
    latitude: 34.2024,
    longitude: -118.2940,
    courtType: "PUBLIC_FREE" as const,
    cost: "Free",
    bookingMethod: "First-come, first-served",
    numberOfCourts: 2,
    surface: "Hard",
    hasLights: false,
    hasRestrooms: false,
    hours: "Dawn to dusk",
    juniorNotes: "Quiet hillside courts. No lights so plan for daytime play only.",
  },
  {
    name: "Balboa Tennis Center",
    address: "16821 Burbank Blvd, Encino, CA 91316",
    latitude: 34.1757,
    longitude: -118.4968,
    courtType: "PUBLIC_PAY" as const,
    cost: "$8–11/hr",
    bookingMethod: "Reserve online at recreation.parks.lacity.gov",
    bookingUrl: "https://recreation.parks.lacity.gov",
    numberOfCourts: 16,
    surface: "Hard",
    hasLights: true,
    hasRestrooms: true,
    hours: "7am–9pm daily",
    netCondition: "GOOD" as const,
    juniorNotes: "Large facility — best to book in advance, especially weekends. 16 courts means you can usually find same-day availability on weekdays.",
  },
  {
    name: "Cheviot Hills Tennis Center",
    address: "2551 Motor Ave, Los Angeles, CA 90064",
    latitude: 34.0337,
    longitude: -118.4156,
    courtType: "PUBLIC_PAY" as const,
    cost: "$8–11/hr",
    bookingMethod: "Reserve online at recreation.parks.lacity.gov",
    bookingUrl: "https://recreation.parks.lacity.gov",
    numberOfCourts: 14,
    surface: "Hard",
    hasLights: true,
    hasRestrooms: true,
    hours: "7am–9pm daily",
    netCondition: "GOOD" as const,
    juniorNotes: "14 courts near Century City. Easy to get weekday afternoon slots.",
  },
  {
    name: "Griffith Park / Riverside Tennis Courts",
    address: "3401 Riverside Dr, Los Angeles, CA 90027",
    latitude: 34.1212,
    longitude: -118.2706,
    courtType: "PUBLIC_FREE" as const,
    cost: "Free",
    bookingMethod: "First-come, first-served",
    numberOfCourts: 12,
    surface: "Hard",
    hasLights: true,
    hasRestrooms: true,
    hours: "Dawn to dusk (lit until 9pm)",
    netCondition: "FAIR" as const,
    juniorNotes: "12 courts along the LA River near Los Feliz. Gets busy on weekends — arrive early.",
    parkingInfo: "Free street parking along Riverside Dr.",
  },
  {
    name: "North Hollywood Park Tennis Courts",
    address: "5301 Tujunga Ave, North Hollywood, CA 91601",
    latitude: 34.1712,
    longitude: -118.3869,
    courtType: "PUBLIC_FREE" as const,
    cost: "Free",
    bookingMethod: "First-come, first-served",
    numberOfCourts: 6,
    surface: "Hard",
    hasLights: true,
    hasRestrooms: true,
    hours: "Dawn to dusk (lit until 10pm)",
    netCondition: "FAIR" as const,
    juniorNotes: "Convenient for North Hollywood and Valley players. Weekday mornings tend to be open.",
  },
  {
    name: "Burbank High School",
    address: "902 N 3rd St, Burbank, CA 91502",
    latitude: 34.1852,
    longitude: -118.3087,
    courtType: "SCHOOL" as const,
    cost: null,
    bookingMethod: "Contact school for community access hours",
    numberOfCourts: 8,
    surface: "Hard",
    hasLights: true,
    hasRestrooms: false,
    juniorNotes: "School courts — check with administration for after-school community access. Typically available on weekends.",
  },
  {
    name: "John Burroughs High School",
    address: "1920 W Clark Ave, Burbank, CA 91506",
    latitude: 34.1783,
    longitude: -118.3415,
    courtType: "SCHOOL" as const,
    cost: null,
    bookingMethod: "Contact school for community access hours",
    numberOfCourts: 8,
    surface: "Hard",
    hasLights: true,
    hasRestrooms: false,
    juniorNotes: "School courts — contact BUSD for public access schedule. Often open on weekends.",
  },
  {
    name: "Studio City Recreation Center",
    address: "12621 Rye St, Studio City, CA 91604",
    latitude: 34.1472,
    longitude: -118.3966,
    courtType: "PUBLIC_FREE" as const,
    cost: "Free",
    bookingMethod: "First-come, first-served",
    numberOfCourts: 2,
    surface: "Hard",
    hasLights: false,
    hasRestrooms: true,
    hours: "Dawn to dusk",
    netCondition: "GOOD" as const,
    bestTimes: "Quiet weekday afternoons",
    juniorNotes: "Only 2 courts but rarely crowded on weekday afternoons. Nice neighborhood feel.",
  },
  {
    name: "Valley Village Park",
    address: "5000 Westpark Dr, Valley Village, CA 91607",
    latitude: 34.1680,
    longitude: -118.3998,
    courtType: "PUBLIC_FREE" as const,
    cost: "Free",
    bookingMethod: "First-come, first-served",
    numberOfCourts: 2,
    surface: "Hard",
    hasLights: false,
    hasRestrooms: true,
    hours: "Dawn to dusk",
    juniorNotes: "Small neighborhood park between Studio City and North Hollywood. 2 courts, usually available.",
  },
] satisfies (typeof courts.$inferInsert)[];

async function seedCourts() {
  console.log("[seed-courts] Starting...");

  const existing = await db.select({ id: courts.id }).from(courts);
  if (existing.length > 0) {
    console.log(`[seed-courts] ${existing.length} courts already exist — skipping.`);
    console.log("[seed-courts] To re-seed, delete all courts from the admin UI first.");
    process.exit(0);
  }

  const inserted = await db.insert(courts).values(COURTS).returning({ id: courts.id, name: courts.name });

  console.log(`[seed-courts] Inserted ${inserted.length} courts:`);
  inserted.forEach((c) => console.log(`  ✓ ${c.name} (id ${c.id})`));
  console.log("[seed-courts] Done.");
  process.exit(0);
}

seedCourts().catch((err) => {
  console.error("[seed-courts] Failed:", err);
  process.exit(1);
});
