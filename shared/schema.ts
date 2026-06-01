import { pgTable, text, serial, integer, boolean, timestamp, jsonb, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
export * from "./models/auth";
export * from "./models/tennis";

// === TABLE DEFINITIONS ===

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  utrRating: real("utr_rating"),
  bio: text("bio"),
  location: text("location"),
  availability: text("availability"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hitRequests = pgTable("hit_requests", {
  id: serial("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  receiverId: text("receiver_id").notNull(),
  status: text("status").default("pending"), // pending, accepted, rejected, completed, cancelled
  scheduledTime: timestamp("scheduled_time"),
  location: text("location"),
  message: text("message"),
  courtId: integer("court_id"),
  practiceType: varchar("practice_type"),
  costSplit: varchar("cost_split"),
  cancelReason: text("cancel_reason"),
  reminder24hSentAt: timestamp("reminder24h_sent_at"),
  reminder1hSentAt: timestamp("reminder1h_sent_at"),
  // Check-in
  checkinRequesterAt: timestamp("checkin_requester_at"),
  checkinReceiverAt: timestamp("checkin_receiver_at"),
  checkinRequesterLocationVerified: boolean("checkin_requester_location_verified").default(false),
  checkinReceiverLocationVerified: boolean("checkin_receiver_location_verified").default(false),
  noShowUserId: text("no_show_user_id"),
  ratingNotifiedAt: timestamp("rating_notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const hitRequestRatings = pgTable("hit_request_ratings", {
  id: serial("id").primaryKey(),
  hitRequestId: integer("hit_request_id").notNull(),
  raterId: text("rater_id").notNull(),
  ratedUserId: text("rated_user_id").notNull(),
  reliability: integer("reliability").notNull(),
  skillAccuracy: integer("skill_accuracy").notNull(),
  partnerQuality: integer("partner_quality").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessionMessages = pgTable("session_messages", {
  id: serial("id").primaryKey(),
  hitRequestId: integer("hit_request_id").notNull(),
  senderId: text("sender_id").notNull(),
  content: text("content").notNull(),
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
export type UpdateHitRequestStatus = { status: 'accepted' | 'rejected' | 'completed' | 'cancelled' };

// Session Messages
export type SessionMessage = typeof sessionMessages.$inferSelect;

// Hit Request Ratings
export type HitRequestRating = typeof hitRequestRatings.$inferSelect;

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
