import type { Express, RequestHandler } from "express";
import { z } from "zod";
import { db } from "./db";
import { courts } from "@shared/models/tennis";
import { authStorage } from "./replit_integrations/auth/storage";
import { eq } from "drizzle-orm";

// ── Admin middleware ───────────────────────────────────────────────────────────

const requireAdmin: RequestHandler = async (req, res, next) => {
  const userId = (req.session as any).userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });

  const user = await authStorage.getUser(userId);
  if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });

  next();
};

// ── Validation ────────────────────────────────────────────────────────────────

const courtSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  latitude: z.number(),
  longitude: z.number(),
  courtType: z.enum(["PUBLIC_FREE", "PUBLIC_PAY", "PRIVATE", "SCHOOL"]),
  cost: z.string().nullable().optional(),
  bookingMethod: z.string().min(1, "Booking method is required"),
  numberOfCourts: z.number().int().min(1),
  surface: z.string().min(1, "Surface is required"),
  hasLights: z.boolean(),
  hours: z.string().nullable().optional(),
  netCondition: z.enum(["GOOD", "FAIR", "POOR"]).nullable().optional(),
  hasRestrooms: z.boolean(),
  parkingInfo: z.string().nullable().optional(),
  bestTimes: z.string().nullable().optional(),
  juniorNotes: z.string().nullable().optional(),
  bookingUrl: z.string().url("Must be a valid URL").nullable().optional().or(z.literal("")),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerAdminRoutes(app: Express): void {
  // List all courts
  app.get("/api/admin/courts", requireAdmin, async (_req, res) => {
    const all = await db.select().from(courts).orderBy(courts.name);
    return res.json(all);
  });

  // Create court
  app.post("/api/admin/courts", requireAdmin, async (req, res) => {
    try {
      const input = courtSchema.parse(req.body);
      const [court] = await db
        .insert(courts)
        .values({
          ...input,
          cost: input.cost ?? null,
          hours: input.hours ?? null,
          netCondition: input.netCondition ?? null,
          parkingInfo: input.parkingInfo ?? null,
          bestTimes: input.bestTimes ?? null,
          juniorNotes: input.juniorNotes ?? null,
          bookingUrl: input.bookingUrl || null,
        })
        .returning();
      return res.status(201).json(court);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[admin] Create court error:", err);
      return res.status(500).json({ message: "Failed to create court" });
    }
  });

  // Update court
  app.put("/api/admin/courts/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const input = courtSchema.parse(req.body);
      const [updated] = await db
        .update(courts)
        .set({
          ...input,
          cost: input.cost ?? null,
          hours: input.hours ?? null,
          netCondition: input.netCondition ?? null,
          parkingInfo: input.parkingInfo ?? null,
          bestTimes: input.bestTimes ?? null,
          juniorNotes: input.juniorNotes ?? null,
          bookingUrl: input.bookingUrl || null,
          updatedAt: new Date(),
        })
        .where(eq(courts.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Court not found" });
      return res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("[admin] Update court error:", err);
      return res.status(500).json({ message: "Failed to update court" });
    }
  });

  // Delete court
  app.delete("/api/admin/courts/:id", requireAdmin, async (req, res) => {
    const id = parseInt(req.params.id);
    await db.delete(courts).where(eq(courts.id, id));
    return res.status(204).send();
  });

  // Geocode address → lat/lng via Nominatim (OpenStreetMap, free, no key needed)
  app.get("/api/admin/geocode", requireAdmin, async (req, res) => {
    const { address } = req.query;
    if (!address || typeof address !== "string") {
      return res.status(400).json({ message: "address query param is required" });
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=us`;
      const response = await fetch(url, {
        headers: {
          "User-Agent": "CourtMatch/1.0 (courtmatch.org)",
          "Accept-Language": "en",
        },
      });
      const data = await response.json() as any[];
      if (!data.length) return res.json(null);
      return res.json({
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      });
    } catch (err) {
      console.error("[admin] Geocode error:", err);
      return res.status(500).json({ message: "Geocoding failed" });
    }
  });
}
