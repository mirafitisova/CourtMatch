import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth";
import { db } from "./db";
import { users } from "@shared/models/auth";
import { eq } from "drizzle-orm";
import { sendHitRequestEmail } from "./email";
import { registerAdminRoutes } from "./adminRoutes";
import { registerSearchRoutes } from "./searchRoutes";
import { haversineDistanceMiles, resolveCoords } from "@shared/lib/geo";
import { weeklyAvailability, playerProfiles, courts } from "@shared/models/tennis";

const playerProfileInputSchema = z.object({
  utrRating: z.number().min(1).max(16.5).optional().nullable(),
  utrProfileUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  utrVerified: z.boolean().optional(),
  school: z.string().optional().nullable(),
  grade: z.number().int().min(9).max(12).optional().nullable(),
  teamLevel: z.enum(["VARSITY", "JV", "NONE"]).optional().nullable(),
  handedness: z.enum(["RIGHT", "LEFT", "AMBIDEXTROUS"]).optional(),
  playStyles: z.array(z.string()).optional(),
  preferredSurface: z.enum(["HARD", "CLAY", "GRASS", "NO_PREFERENCE"]).optional().nullable(),
  playingFrequency: z.string().optional().nullable(),
  preferredAreas: z.array(z.string()).optional(),
  maxDriveMiles: z.number().int().positive().optional().nullable(),
  bio: z.string().max(280).optional().nullable(),
});

const availabilitySlotsSchema = z.object({
  slots: z.array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
    })
  ),
});

function calcCompleteness(profile: Record<string, any>, availCount: number): number {
  const checks = [
    profile.utrRating != null,
    !!(profile.school),
    profile.grade != null,
    profile.teamLevel != null,
    !!(profile.handedness),
    (profile.playStyles?.length ?? 0) > 0,
    profile.preferredSurface != null,
    !!(profile.bio),
    !!(profile.playingFrequency),
    (profile.preferredAreas?.length ?? 0) > 0,
    profile.maxDriveMiles != null,
    availCount > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerAdminRoutes(app);
  registerSearchRoutes(app);

  // Player Profile (extended tennis schema)
  app.get("/api/player-profile", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const profile = await storage.getPlayerProfile(userId);
    if (!profile) return res.status(404).json({ message: "Not found" });
    res.json(profile);
  });

  app.put("/api/player-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const input = playerProfileInputSchema.parse(req.body);
      // Auto-set utrVerified if a non-empty URL is provided
      if (input.utrProfileUrl && input.utrProfileUrl.length > 0 && input.utrVerified === undefined) {
        (input as any).utrVerified = true;
      }
      const profile = await storage.upsertPlayerProfile(userId, input);
      res.json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  // Weekly Availability
  app.get("/api/weekly-availability", isAuthenticated, async (req, res) => {
    const userId = (req.session as any).userId;
    const rows = await storage.getWeeklyAvailability(userId);
    res.json(rows);
  });

  app.put("/api/weekly-availability", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { slots } = availabilitySlotsSchema.parse(req.body);
      const rows = await storage.replaceWeeklyAvailability(userId, slots);

      // Recalculate and persist profileCompleteness
      const profile = await storage.getPlayerProfile(userId);
      if (profile) {
        const score = calcCompleteness(profile as any, rows.length);
        await storage.upsertPlayerProfile(userId, { profileCompleteness: score });
      }

      res.json(rows);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.profiles.list.path, isAuthenticated, async (req, res) => {
    const filters = {
        search: req.query.search as string,
        minUtr: req.query.minUtr ? Number(req.query.minUtr) : undefined,
        maxUtr: req.query.maxUtr ? Number(req.query.maxUtr) : undefined,
    };
    const profiles = await storage.getProfiles(filters);
    res.json(profiles);
  });

  app.get(api.profiles.get.path, isAuthenticated, async (req, res) => {
    const profile = await storage.getProfile(req.params.userId);
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' });
    }
    res.json(profile);
  });

  app.put(api.profiles.update.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const input = api.profiles.update.input.parse(req.body);
      const profile = await storage.updateProfile(userId, input);
      res.json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.hitRequests.list.path, isAuthenticated, async (req, res) => {
     const userId = (req.session as any).userId;
     const requests = await storage.getHitRequests(userId);
     res.json(requests);
  });

  app.post(api.hitRequests.create.path, isAuthenticated, async (req, res) => {
    try {
      const requesterId = (req.session as any).userId;
      const body = { ...req.body, requesterId };

      // Coerce scheduledTime string → Date if present
      if (body.scheduledTime && typeof body.scheduledTime === "string") {
        body.scheduledTime = new Date(body.scheduledTime);
      }

      const input = api.hitRequests.create.input.parse(body);
      const request = await storage.createHitRequest(input);
      res.status(201).json(request);

      // Send email notification to receiver (non-blocking, best-effort)
      try {
        const [receiverUser] = await db.select().from(users).where(eq(users.id, input.receiverId)).limit(1);
        const requesterProfile = await storage.getProfile(requesterId);
        const [requesterUser] = await db.select().from(users).where(eq(users.id, requesterId)).limit(1);

        if (receiverUser?.email) {
          await sendHitRequestEmail({
            toEmail: receiverUser.email,
            toFirstName: receiverUser.firstName || "there",
            fromFirstName: requesterUser?.firstName || "Someone",
            fromLastName: requesterUser?.lastName || "",
            fromUtr: requesterProfile?.utrRating ?? null,
            message: input.message ?? null,
          });
        }
      } catch (emailErr) {
        console.error("[email] Non-fatal error sending notification:", emailErr);
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.patch(api.hitRequests.updateStatus.path, isAuthenticated, async (req, res) => {
      try {
        const userId = (req.session as any).userId;
        const { status, scheduledTime, location } = req.body;
        const requests = await storage.getHitRequests(userId);
        const request = requests.find(r => r.id === Number(req.params.id));
        if (!request) return res.status(404).json({ message: "Request not found" });
        if (request.requesterId !== userId && request.receiverId !== userId) {
          return res.status(403).json({ message: "Not authorized" });
        }
        const scheduling = {
          scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
          location: location || undefined,
        };
        const updated = await storage.updateHitRequestStatus(Number(req.params.id), status, scheduling);
        if (!updated) return res.status(404).json({ message: "Request not found" });
        res.json(updated);
      } catch (err) {
          res.status(400).json({ message: "Invalid update" });
      }
  });

  // ── Courts directory ──────────────────────────────────────────────────────────
  app.get("/api/courts", isAuthenticated, async (req, res) => {
    try {
      const myUserId = (req.session as any).userId;

      // Get user's coords for distance calculation
      const [myRow] = await db
        .select({ profile: playerProfiles, user: { zipCode: users.zipCode } })
        .from(playerProfiles)
        .leftJoin(users, eq(playerProfiles.userId, users.id))
        .where(eq(playerProfiles.userId, myUserId))
        .limit(1);

      const myCoords = myRow
        ? resolveCoords(myRow.user?.zipCode ?? null, myRow.profile.preferredAreas ?? [])
        : null;

      const allCourts = await db.select().from(courts).orderBy(courts.name);

      const withDistance = allCourts.map((court) => {
        const distanceMiles =
          myCoords
            ? Math.round(
                haversineDistanceMiles(myCoords, { lat: court.latitude, lng: court.longitude }) * 10,
              ) / 10
            : null;
        return { ...court, distanceMiles };
      });

      return res.json(withDistance);
    } catch (err) {
      console.error("Courts error:", err);
      return res.status(500).json({ message: "Failed to load courts" });
    }
  });

  // ── Player detail page (/api/player/:id) ─────────────────────────────────────
  app.get("/api/player/:id", isAuthenticated, async (req, res) => {
    try {
      const myUserId = (req.session as any).userId;
      const targetId = req.params.id;

      if (targetId === myUserId) {
        return res.status(400).json({ message: "Cannot view your own profile here" });
      }

      // Load target player
      const [targetRow] = await db
        .select({ profile: playerProfiles, user: { firstName: users.firstName, lastName: users.lastName, zipCode: users.zipCode } })
        .from(playerProfiles)
        .leftJoin(users, eq(playerProfiles.userId, users.id))
        .where(eq(playerProfiles.userId, targetId))
        .limit(1);

      if (!targetRow) return res.status(404).json({ message: "Player not found" });

      // Load my profile for connection comparisons
      const [myRow] = await db
        .select({ profile: playerProfiles, user: { zipCode: users.zipCode } })
        .from(playerProfiles)
        .leftJoin(users, eq(playerProfiles.userId, users.id))
        .where(eq(playerProfiles.userId, myUserId))
        .limit(1);

      // Availability overlap
      const [myAvail, theirAvail] = await Promise.all([
        db.select().from(weeklyAvailability).where(eq(weeklyAvailability.userId, myUserId)),
        db.select().from(weeklyAvailability).where(eq(weeklyAvailability.userId, targetId)),
      ]);

      const overlapSlots = myAvail.filter((mine) =>
        theirAvail.some(
          (theirs) =>
            theirs.dayOfWeek === mine.dayOfWeek &&
            theirs.startTime === mine.startTime,
        ),
      );

      // Distance
      const myCoords = myRow
        ? resolveCoords(myRow.user?.zipCode ?? null, myRow.profile.preferredAreas ?? [])
        : null;
      const theirCoords = resolveCoords(
        targetRow.user?.zipCode ?? null,
        targetRow.profile.preferredAreas ?? [],
      );
      const distanceMiles =
        myCoords && theirCoords
          ? Math.round(haversineDistanceMiles(myCoords, theirCoords) * 10) / 10
          : null;

      // Same school
      const mySchool = myRow?.profile.school?.trim().toLowerCase() ?? null;
      const theirSchool = targetRow.profile.school?.trim().toLowerCase() ?? null;
      const sameSchool = !!(mySchool && theirSchool && mySchool === theirSchool);

      const { profile, user } = targetRow;

      return res.json({
        userId: profile.userId,
        firstName: user?.firstName ?? null,
        lastInitial: user?.lastName ? user.lastName[0] : null,
        utrRating: profile.utrRating ?? null,
        utrVerified: profile.utrVerified ?? false,
        utrProfileUrl: profile.utrProfileUrl ?? null,
        school: profile.school ?? null,
        grade: profile.grade ?? null,
        teamLevel: profile.teamLevel ?? null,
        handedness: profile.handedness ?? null,
        playStyles: profile.playStyles ?? [],
        preferredSurface: profile.preferredSurface ?? null,
        playingFrequency: profile.playingFrequency ?? null,
        preferredAreas: profile.preferredAreas ?? [],
        maxDriveMiles: profile.maxDriveMiles ?? null,
        bio: profile.bio ?? null,
        profileCompleteness: profile.profileCompleteness ?? 0,
        // Availability
        availability: theirAvail,
        // Connection signals
        sameSchool,
        distanceMiles,
        availabilityOverlapSlots: overlapSlots,
      });
    } catch (err) {
      console.error("Player detail error:", err);
      return res.status(500).json({ message: "Failed to load player" });
    }
  });

  return httpServer;
}
