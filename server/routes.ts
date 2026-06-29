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
import { sendHitRequestEmail, sendSessionReminderEmail, sendNoShowEmail, sendRatingPromptEmail } from "./email";
import { registerAdminRoutes } from "./adminRoutes";
import { registerSearchRoutes } from "./searchRoutes";
import { haversineDistanceMiles, resolveCoords } from "@shared/lib/geo";
import { weeklyAvailability, playerProfiles, courts } from "@shared/models/tennis";

function calcAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

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
      const { status, scheduledTime, location, courtId, practiceType, costSplit, cancelReason } = req.body;
      const requests = await storage.getHitRequests(userId);
      const request = requests.find(r => r.id === Number(req.params.id));
      if (!request) return res.status(404).json({ message: "Request not found" });
      if (request.requesterId !== userId && request.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const updated = await storage.updateHitRequestStatus(Number(req.params.id), status, {
        scheduledTime: scheduledTime ? new Date(scheduledTime) : undefined,
        location: location || undefined,
        courtId: courtId || undefined,
        practiceType: practiceType || undefined,
        costSplit: costSplit || undefined,
        cancelReason: cancelReason || undefined,
      });
      if (!updated) return res.status(404).json({ message: "Request not found" });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: "Invalid update" });
    }
  });

  // ── Session detail & messaging ────────────────────────────────────────────────

  // ── Player stats ──────────────────────────────────────────────────────────────
  app.get("/api/stats/me", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const stats = await storage.getPlayerStats(userId);
      res.json(stats);
    } catch (err) {
      console.error("Stats error:", err);
      res.status(500).json({ message: "Failed to load stats" });
    }
  });

  app.get("/api/stats/:userId", isAuthenticated, async (req, res) => {
    try {
      const stats = await storage.getPlayerStats(req.params.userId);
      res.json(stats);
    } catch (err) {
      console.error("Stats error:", err);
      res.status(500).json({ message: "Failed to load stats" });
    }
  });

  // ── Session history ──────────────────────────────────────────────────────────
  // Must be registered before /api/sessions/:id to avoid route collision
  app.get("/api/sessions/history", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const history = await storage.getSessionHistory(userId);
      res.json(history);
    } catch (err) {
      console.error("Session history error:", err);
      res.status(500).json({ message: "Failed to load session history" });
    }
  });

  app.get("/api/sessions/upcoming", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const sessions = await storage.getUpcomingSessions(userId);
      res.json(sessions);
    } catch (err) {
      console.error("Upcoming sessions error:", err);
      res.status(500).json({ message: "Failed to load upcoming sessions" });
    }
  });

  app.get("/api/sessions/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const session = await storage.getSessionDetail(Number(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.requesterId !== userId && session.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      res.json(session);
    } catch (err) {
      console.error("Session detail error:", err);
      res.status(500).json({ message: "Failed to load session" });
    }
  });

  app.get("/api/sessions/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const session = await storage.getSessionDetail(Number(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.requesterId !== userId && session.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const messages = await storage.getSessionMessages(Number(req.params.id));
      res.json(messages);
    } catch (err) {
      res.status(500).json({ message: "Failed to load messages" });
    }
  });

  app.post("/api/sessions/:id/messages", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Message cannot be empty" });
      if (content.length > 500) return res.status(400).json({ message: "Message too long (max 500 characters)" });
      const session = await storage.getSessionDetail(Number(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.requesterId !== userId && session.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const msg = await storage.createSessionMessage(Number(req.params.id), userId, content.trim());
      res.status(201).json(msg);
    } catch (err) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.post("/api/sessions/:id/checkin", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { locationVerified = false } = req.body;
      const session = await storage.getSessionDetail(Number(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.requesterId !== userId && session.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (session.status !== "accepted") {
        return res.status(400).json({ message: "Session is not active" });
      }
      const isRequester = session.requesterId === userId;
      const alreadyCheckedIn = isRequester ? !!session.checkinRequesterAt : !!session.checkinReceiverAt;
      if (alreadyCheckedIn) {
        return res.status(400).json({ message: "Already checked in" });
      }
      const updated = await storage.checkinSession(Number(req.params.id), isRequester, !!locationVerified);
      res.json(updated);
    } catch (err) {
      console.error("Checkin error:", err);
      res.status(500).json({ message: "Check-in failed" });
    }
  });

  app.post("/api/sessions/:id/no-show", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const session = await storage.getSessionDetail(Number(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.requesterId !== userId && session.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (session.status !== "accepted") {
        return res.status(400).json({ message: "Session is not active" });
      }

      const isRequester = session.requesterId === userId;
      const myCheckinTime = isRequester ? session.checkinRequesterAt : session.checkinReceiverAt;
      const partnerCheckinTime = isRequester ? session.checkinReceiverAt : session.checkinRequesterAt;

      if (!myCheckinTime) {
        return res.status(400).json({ message: "You must check in before marking a no-show" });
      }
      if (partnerCheckinTime) {
        return res.status(400).json({ message: "Your partner has already checked in" });
      }
      const minsSinceCheckin = (Date.now() - new Date(myCheckinTime).getTime()) / 60_000;
      if (minsSinceCheckin < 20) {
        return res.status(400).json({ message: "Wait 20 minutes after checking in before marking a no-show" });
      }

      const noShowUserId = isRequester ? session.receiverId : session.requesterId;
      await storage.markNoShow(Number(req.params.id), noShowUserId);
      await storage.incrementNoShowCount(noShowUserId);

      // Send no-show notification (non-blocking)
      const noShowPlayerInfo = isRequester ? session.receiver : session.requester;
      const markerInfo = isRequester ? session.requester : session.receiver;
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
      if (noShowPlayerInfo.user?.email) {
        sendNoShowEmail({
          toEmail: noShowPlayerInfo.user.email,
          toFirstName: noShowPlayerInfo.user.firstName ?? "there",
          markedByFirstName: markerInfo.user?.firstName ?? "Your partner",
          scheduledAt: session.scheduledTime!,
          courtName: session.court?.name ?? null,
          sessionId: session.id,
          baseUrl,
        }).catch(err => console.error("[email] No-show email failed:", err));
      }

      res.json({ success: true });
    } catch (err) {
      console.error("No-show error:", err);
      res.status(500).json({ message: "Failed to mark no-show" });
    }
  });

  app.post("/api/sessions/:id/cancel", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const { reason } = req.body;
      const session = await storage.getSessionDetail(Number(req.params.id));
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.requesterId !== userId && session.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (session.status !== "accepted") {
        return res.status(400).json({ message: "Only accepted sessions can be cancelled" });
      }
      const updated = await storage.updateHitRequestStatus(Number(req.params.id), "cancelled", {
        cancelReason: reason || null,
      });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to cancel session" });
    }
  });

  // ── Session ratings ───────────────────────────────────────────────────────────

  const ratingSchema = z.object({
    reliability: z.number().int().min(1).max(5),
    skillAccuracy: z.number().int().min(1).max(5),
    partnerQuality: z.number().int().min(1).max(5),
    note: z.string().max(140).nullable().optional(),
  });

  app.get("/api/sessions/:id/my-rating", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const rating = await storage.getMyRating(Number(req.params.id), userId);
      res.json(rating ?? null);
    } catch (err) {
      res.status(500).json({ message: "Failed to load rating" });
    }
  });

  app.post("/api/sessions/:id/rate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.session as any).userId;
      const sessionId = Number(req.params.id);
      const session = await storage.getSessionDetail(sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      if (session.requesterId !== userId && session.receiverId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }
      if (!["accepted", "no_show"].includes(session.status ?? "")) {
        return res.status(400).json({ message: "Session cannot be rated" });
      }
      if (session.scheduledTime && new Date(session.scheduledTime) > new Date()) {
        return res.status(400).json({ message: "Session hasn't started yet" });
      }
      const existing = await storage.getMyRating(sessionId, userId);
      if (existing) return res.status(409).json({ message: "Already rated" });

      const input = ratingSchema.parse(req.body);
      const ratedUserId = session.requesterId === userId ? session.receiverId : session.requesterId;
      const rating = await storage.submitRating(sessionId, userId, ratedUserId, input);
      await storage.recalculatePlayerRating(ratedUserId);
      res.status(201).json(rating);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Rating error:", err);
      res.status(500).json({ message: "Failed to submit rating" });
    }
  });

  // ── Session reminder cron (Render cron job hits this every 30 min) ────────────
  app.post("/api/cron/session-reminders", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = req.headers.authorization;
      if (auth !== `Bearer ${secret}`) return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const now = new Date();
      const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

      const windows = [
        { start: new Date(now.getTime() + 23 * 3600_000), end: new Date(now.getTime() + 25 * 3600_000), type: "24h" as const },
        { start: new Date(now.getTime() + 50 * 60_000),   end: new Date(now.getTime() + 70 * 60_000),   type: "1h"  as const },
      ];

      let sent = 0;
      for (const { start, end, type } of windows) {
        const sessions = await storage.getSessionsForReminder(start, end, type);
        for (const req of sessions) {
          const detail = await storage.getSessionDetail(req.id);
          if (!detail?.scheduledTime) continue;

          const pairs = [
            { user: detail.requester, partner: detail.receiver },
            { user: detail.receiver, partner: detail.requester },
          ];

          for (const { user, partner } of pairs) {
            if (!user.user?.email) continue;
            const age = user.user.dateOfBirth ? calcAge(user.user.dateOfBirth) : 99;

            await sendSessionReminderEmail({
              toEmail: user.user.email,
              toFirstName: user.user.firstName ?? "there",
              partnerFirstName: partner.user?.firstName ?? "",
              partnerLastName: partner.user?.lastName ?? "",
              scheduledAt: detail.scheduledTime,
              courtName: detail.court?.name ?? null,
              courtAddress: detail.court?.address ?? null,
              practiceType: detail.practiceType ?? null,
              sessionId: detail.id,
              hoursUntil: type === "24h" ? 24 : 1,
              baseUrl,
            });
            sent++;

            if (type === "24h" && age < 18 && user.user.parentEmail) {
              await sendSessionReminderEmail({
                toEmail: user.user.parentEmail,
                toFirstName: "",
                partnerFirstName: partner.user?.firstName ?? "",
                partnerLastName: partner.user?.lastName ?? "",
                scheduledAt: detail.scheduledTime,
                courtName: detail.court?.name ?? null,
                courtAddress: detail.court?.address ?? null,
                practiceType: detail.practiceType ?? null,
                sessionId: detail.id,
                hoursUntil: 24,
                baseUrl,
                isParentNotification: true,
                playerFirstName: user.user.firstName ?? "Your child",
              });
              sent++;
            }
          }
          await storage.markReminderSent(req.id, type);
        }
      }

      // Rating notifications: sessions scheduled 90–8h ago, not yet notified
      const ratingWindowEnd = new Date(now.getTime() - 90 * 60_000);
      const ratingWindowStart = new Date(now.getTime() - 8 * 3600_000);
      const ratingSessions = await storage.getSessionsForRatingNotification(ratingWindowStart, ratingWindowEnd);
      for (const s of ratingSessions) {
        const detail = await storage.getSessionDetail(s.id);
        if (!detail) continue;
        const pairs = [
          { user: detail.requester, partner: detail.receiver },
          { user: detail.receiver, partner: detail.requester },
        ];
        for (const { user, partner } of pairs) {
          if (!user.user?.email) continue;
          await sendRatingPromptEmail({
            toEmail: user.user.email,
            toFirstName: user.user.firstName ?? "there",
            partnerFirstName: partner.user?.firstName ?? "",
            partnerLastName: partner.user?.lastName ?? "",
            sessionId: detail.id,
            baseUrl,
          });
          sent++;
        }
        await storage.markRatingNotificationSent(s.id);
      }

      return res.json({ sent });
    } catch (err) {
      console.error("Session reminder cron error:", err);
      return res.status(500).json({ message: "Cron failed" });
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
        noShowCount: profile.noShowCount ?? 0,
        sessionCount: profile.sessionCount ?? 0,
        avgRating: profile.avgRating ?? null,
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
