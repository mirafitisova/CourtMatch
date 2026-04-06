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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerAdminRoutes(app);

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

  return httpServer;
}
