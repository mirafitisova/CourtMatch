import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { isAuthenticated } from "./replit_integrations/auth";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

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
      const input = api.hitRequests.create.input.parse({
          ...req.body,
          requesterId: requesterId
      });
      
      const request = await storage.createHitRequest(input);
      res.status(201).json(request);
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
        const { status } = req.body;
        const requests = await storage.getHitRequests(userId);
        const request = requests.find(r => r.id === Number(req.params.id));
        if (!request) return res.status(404).json({ message: "Request not found" });
        if (request.requesterId !== userId && request.receiverId !== userId) {
          return res.status(403).json({ message: "Not authorized" });
        }
        const updated = await storage.updateHitRequestStatus(Number(req.params.id), status);
        if (!updated) return res.status(404).json({ message: "Request not found" });
        res.json(updated);
      } catch (err) {
          res.status(400).json({ message: "Invalid update" });
      }
  });

  return httpServer;
}
