import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
export * from "./models/auth";

// === TABLE DEFINITIONS ===

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  utrRating: real("utr_rating"),
  bio: text("bio"),
  location: text("location"),
  availability: text("availability"),
  playStyle: text("play_style"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hitRequests = pgTable("hit_requests", {
  id: serial("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  status: text("status").default("pending"), // pending, accepted, rejected, completed
  scheduledTime: timestamp("scheduled_time"),
  location: text("location"),
  message: text("message"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const profilesRelations = relations(profiles, ({ one }) => ({
  // Relation to auth users is logical via userId, but auth tables are separate
}));

export const hitRequestsRelations = relations(hitRequests, ({ one }) => ({
  // Relations would be handled logically via userId lookup
}));

// === BASE SCHEMAS ===
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true });
export const insertHitRequestSchema = createInsertSchema(hitRequests).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

// Profiles
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type UpdateProfileRequest = Partial<InsertProfile>;

// Hit Requests
export type HitRequest = typeof hitRequests.$inferSelect;
export type InsertHitRequest = z.infer<typeof insertHitRequestSchema>;
export type UpdateHitRequestStatus = { status: 'accepted' | 'rejected' | 'completed' };

// Complex Response Types
export interface ProfileWithUser extends Profile {
  user?: {
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
}

export interface HitRequestWithProfiles extends HitRequest {
  requester?: ProfileWithUser;
  receiver?: ProfileWithUser;
}
