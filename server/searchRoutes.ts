import type { Express } from "express";
import { db } from "./db";
import { playerProfiles, weeklyAvailability } from "@shared/models/tennis";
import { users } from "@shared/models/auth";
import { eq, ne } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";
import { haversineDistanceMiles, resolveCoords } from "@shared/lib/geo";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AvailSlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface SearchResult {
  userId: string;
  firstName: string | null;
  lastInitial: string | null;
  utrRating: number | null;
  utrVerified: boolean;
  school: string | null;
  distanceMiles: number | null;
  playStyles: string[];
  preferredAreas: string[];
  availabilityOverlapSlots: AvailSlot[];
  availabilityOverlapText: string;
  compatibilityScore: number;
  // Connection signals
  sameSchool: boolean;
  nearbyPlayer: boolean; // within 5 miles
}

// ── Overlap formatting ─────────────────────────────────────────────────────────

const DAY_SHORT: Record<number, string> = {
  0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat",
};

const SLOT_LABEL: Record<string, string> = {
  "06:00": "mornings",
  "12:00": "afternoons",
  "17:00": "evenings",
};

function formatOverlap(slots: AvailSlot[]): string {
  if (slots.length === 0) return "";

  const byDay = new Map<number, string[]>();
  for (const { dayOfWeek, startTime } of slots) {
    if (!byDay.has(dayOfWeek)) byDay.set(dayOfWeek, []);
    byDay.get(dayOfWeek)!.push(SLOT_LABEL[startTime] ?? startTime);
  }

  const parts: string[] = [];
  for (const day of [1, 2, 3, 4, 5, 6, 0]) {
    if (!byDay.has(day)) continue;
    parts.push(`${DAY_SHORT[day]} ${byDay.get(day)!.join("/")}`);
  }

  if (parts.length === 0) return "";
  if (parts.length <= 2) return `Both free: ${parts.join(", ")}`;
  return `Both free: ${parts.slice(0, 2).join(", ")} +${parts.length - 2} more`;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

function scoreUtr(myUtr: number | null, theirUtr: number | null): number {
  if (myUtr == null || theirUtr == null) return 50;
  const diff = Math.abs(myUtr - theirUtr);
  return Math.max(0, (1 - diff / 3) * 100);
}

function scoreDistance(
  distanceMiles: number | null,
  maxDistMiles: number,
): number {
  if (distanceMiles === null) return 50;
  return Math.max(0, (1 - distanceMiles / maxDistMiles) * 100);
}

function scoreAvailability(overlapCount: number, mySlotCount: number): number {
  if (mySlotCount === 0) return 50;
  return Math.min(100, (overlapCount / mySlotCount) * 100);
}

function scoreStyles(
  sharedCount: number,
  myStyleCount: number,
): number {
  if (myStyleCount === 0) return 50;
  return Math.min(100, (sharedCount / myStyleCount) * 100);
}

function calcCompatibility(
  utrS: number,
  distS: number,
  availS: number,
  styleS: number,
): number {
  return Math.round(utrS * 0.4 + distS * 0.3 + availS * 0.2 + styleS * 0.1);
}

// ── Availability day filter ────────────────────────────────────────────────────

function passesAvailFilter(
  theirAvail: AvailSlot[],
  dayFilter: string,
): boolean {
  if (!dayFilter || dayFilter === "any") return true;
  if (dayFilter === "weekdays")
    return theirAvail.some((a) => a.dayOfWeek >= 1 && a.dayOfWeek <= 5);
  if (dayFilter === "weekends")
    return theirAvail.some((a) => a.dayOfWeek === 0 || a.dayOfWeek === 6);
  // Specific day number ("0"–"6")
  const dayNum = parseInt(dayFilter, 10);
  if (!isNaN(dayNum)) return theirAvail.some((a) => a.dayOfWeek === dayNum);
  return true;
}

// ── Route registration ─────────────────────────────────────────────────────────

export function registerSearchRoutes(app: Express) {
  app.get("/api/search", isAuthenticated, async (req, res) => {
    const myUserId = (req.session as any).userId as string;

    // Parse query params
    const minUtr = req.query.minUtr ? parseFloat(req.query.minUtr as string) : null;
    const maxUtr = req.query.maxUtr ? parseFloat(req.query.maxUtr as string) : null;
    const maxDistance = req.query.maxDistance
      ? parseFloat(req.query.maxDistance as string)
      : 25;
    const practiceTypes = req.query.practiceTypes
      ? (req.query.practiceTypes as string).split(",").filter(Boolean)
      : [];
    const dayFilter = (req.query.dayFilter as string) ?? "any";
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 0;
    const PAGE_SIZE = 20;

    // ── Load searcher's data ────────────────────────────────────────────────────

    const [myProfileRow] = await db
      .select({ profile: playerProfiles, user: { zipCode: users.zipCode } })
      .from(playerProfiles)
      .leftJoin(users, eq(playerProfiles.userId, users.id))
      .where(eq(playerProfiles.userId, myUserId))
      .limit(1);

    const myProfile = myProfileRow?.profile ?? null;
    const myZip = myProfileRow?.user?.zipCode ?? null;

    const myAvail: AvailSlot[] = await db
      .select()
      .from(weeklyAvailability)
      .where(eq(weeklyAvailability.userId, myUserId));

    const myCoords = myProfile
      ? resolveCoords(myZip, myProfile.preferredAreas ?? [])
      : null;

    // ── Load all other players ──────────────────────────────────────────────────

    const otherProfilesRaw = await db
      .select({
        profile: playerProfiles,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          zipCode: users.zipCode,
        },
      })
      .from(playerProfiles)
      .leftJoin(users, eq(playerProfiles.userId, users.id))
      .where(ne(playerProfiles.userId, myUserId));

    // Load all availability in one query, index by userId
    const allAvail: AvailSlot[] = await db.select().from(weeklyAvailability);
    const availByUser = new Map<string, AvailSlot[]>();
    for (const row of allAvail) {
      if (!availByUser.has(row.userId)) availByUser.set(row.userId, []);
      availByUser.get(row.userId)!.push(row);
    }

    // ── Score every player ──────────────────────────────────────────────────────

    const scored: (SearchResult & { _score: number })[] = [];

    for (const { profile, user } of otherProfilesRaw) {
      const theirAvail = availByUser.get(profile.userId) ?? [];
      const theirCoords = resolveCoords(
        user?.zipCode ?? null,
        profile.preferredAreas ?? [],
      );

      // Distance
      let distanceMiles: number | null = null;
      if (myCoords && theirCoords) {
        distanceMiles = haversineDistanceMiles(myCoords, theirCoords);
      }

      // Availability overlap (matching dayOfWeek + startTime)
      const overlapSlots = myAvail.filter((mine) =>
        theirAvail.some(
          (theirs) =>
            theirs.dayOfWeek === mine.dayOfWeek &&
            theirs.startTime === mine.startTime,
        ),
      );

      // Practice type overlap
      const myStyles = myProfile?.playStyles ?? [];
      const theirStyles = profile.playStyles ?? [];
      const sharedStyles = myStyles.filter((s) => theirStyles.includes(s));

      // Scores
      const utrS = scoreUtr(myProfile?.utrRating ?? null, profile.utrRating);
      const distS = scoreDistance(distanceMiles, maxDistance);
      const availS = scoreAvailability(overlapSlots.length, myAvail.length);
      const styleS = scoreStyles(sharedStyles.length, myStyles.length);
      const totalScore = calcCompatibility(utrS, distS, availS, styleS);

      // ── Apply filters ──────────────────────────────────────────────────────

      if (minUtr !== null && (profile.utrRating ?? 0) < minUtr) continue;
      if (maxUtr !== null && (profile.utrRating ?? 16.5) > maxUtr) continue;
      if (
        distanceMiles !== null &&
        distanceMiles > maxDistance
      )
        continue;
      if (
        practiceTypes.length > 0 &&
        !practiceTypes.some((t) => theirStyles.includes(t))
      )
        continue;
      if (!passesAvailFilter(theirAvail, dayFilter)) continue;

      const sameSchool =
        !!(myProfile?.school && profile.school &&
          myProfile.school.trim().toLowerCase() === profile.school.trim().toLowerCase());
      const nearbyPlayer = distanceMiles !== null && distanceMiles <= 5;

      scored.push({
        userId: profile.userId,
        firstName: user?.firstName ?? null,
        lastInitial: user?.lastName ? user.lastName[0] : null,
        utrRating: profile.utrRating ?? null,
        utrVerified: profile.utrVerified ?? false,
        school: profile.school ?? null,
        distanceMiles:
          distanceMiles !== null ? Math.round(distanceMiles * 10) / 10 : null,
        playStyles: theirStyles,
        preferredAreas: profile.preferredAreas ?? [],
        availabilityOverlapSlots: overlapSlots,
        availabilityOverlapText: formatOverlap(overlapSlots),
        compatibilityScore: totalScore,
        sameSchool,
        nearbyPlayer,
        _score: totalScore,
      });
    }

    // Sort by compatibility score descending
    scored.sort((a, b) => b._score - a._score);

    const total = scored.length;
    const slice = scored.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const results = slice.map(({ _score, ...r }) => r);

    res.json({
      results,
      total,
      hasMore: (page + 1) * PAGE_SIZE < total,
      page,
    });
  });
}
