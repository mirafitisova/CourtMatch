/**
 * Extended tennis schema — tables for sprints 2+.
 *
 * NOTE: This project uses Drizzle ORM (not Prisma).
 *
 * Naming notes:
 *  - "matchRequests"  supersedes the simple "hit_requests" table once the new UI is built.
 *  - "matchSessions"  is the post-acceptance session record; can't use "sessions" because
 *    that name is already taken by the express-session store.
 */

import { sql, relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  integer,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const teamLevelEnum = pgEnum("team_level", ["VARSITY", "JV", "NONE"]);
export const handednessEnum = pgEnum("handedness", ["RIGHT", "LEFT", "AMBIDEXTROUS"]);
export const preferredSurfaceEnum = pgEnum("preferred_surface", ["HARD", "CLAY", "GRASS", "NO_PREFERENCE"]);
export const courtTypeEnum = pgEnum("court_type", ["PUBLIC_FREE", "PUBLIC_PAY", "PRIVATE", "SCHOOL"]);
export const netConditionEnum = pgEnum("net_condition", ["GOOD", "FAIR", "POOR"]);
export const matchRequestStatusEnum = pgEnum("match_request_status", [
  "PENDING", "ACCEPTED", "DECLINED", "COUNTER", "EXPIRED", "CANCELLED",
]);
export const costSplitEnum = pgEnum("cost_split", [
  "I_COVER", "SPLIT_50_50", "YOU_COVER", "FREE_COURT",
]);
export const matchSessionStatusEnum = pgEnum("match_session_status", [
  "CONFIRMED",
  "PLAYER1_CHECKED_IN",
  "PLAYER2_CHECKED_IN",
  "BOTH_CHECKED_IN",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
]);

// ── PlayerProfile ─────────────────────────────────────────────────────────────

export const playerProfiles = pgTable("player_profiles", {
  id: serial("id").primaryKey(),
  /** One-to-one with users */
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  utrRating: real("utr_rating"),
  utrProfileUrl: varchar("utr_profile_url"),
  utrVerified: boolean("utr_verified").notNull().default(false),
  school: varchar("school"),
  /** 9 | 10 | 11 | 12 — null for non-high-school players */
  grade: integer("grade"),
  teamLevel: teamLevelEnum("team_level"),
  handedness: handednessEnum("handedness").notNull().default("RIGHT"),
  /** Tags e.g. ["rally", "match_play", "serve_practice"] */
  playStyles: text("play_styles").array().notNull().default(sql`ARRAY[]::text[]`),
  preferredSurface: preferredSurfaceEnum("preferred_surface"),
  /** e.g. "1-2 times/week" */
  playingFrequency: varchar("playing_frequency"),
  /** Area names the player prefers to hit in */
  preferredAreas: text("preferred_areas").array().notNull().default(sql`ARRAY[]::text[]`),
  /** Max drive distance in miles */
  maxDriveMiles: integer("max_drive_miles"),
  /** Max 280 characters */
  bio: varchar("bio", { length: 280 }),
  /** Computed 0–100 score; updated whenever profile fields change */
  profileCompleteness: integer("profile_completeness").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type PlayerProfile = typeof playerProfiles.$inferSelect;
export type InsertPlayerProfile = typeof playerProfiles.$inferInsert;

// ── WeeklyAvailability ────────────────────────────────────────────────────────

export const weeklyAvailability = pgTable("weekly_availability", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: integer("day_of_week").notNull(),
  /** "HH:MM" 24-hour format */
  startTime: varchar("start_time", { length: 5 }).notNull(),
  endTime: varchar("end_time", { length: 5 }).notNull(),
});

export type WeeklyAvailability = typeof weeklyAvailability.$inferSelect;
export type InsertWeeklyAvailability = typeof weeklyAvailability.$inferInsert;

// ── Court ─────────────────────────────────────────────────────────────────────

export const courts = pgTable("courts", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(),
  address: text("address").notNull(),
  /** WGS84 decimal degrees */
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  courtType: courtTypeEnum("court_type").notNull(),
  /** Human-readable e.g. "Free", "$8/hr" */
  cost: varchar("cost"),
  bookingMethod: varchar("booking_method").notNull(),
  numberOfCourts: integer("number_of_courts").notNull(),
  /** e.g. "Hard", "Clay", "Grass" */
  surface: varchar("surface").notNull(),
  hasLights: boolean("has_lights").notNull().default(false),
  /** e.g. "6am–10pm daily" */
  hours: varchar("hours"),
  netCondition: netConditionEnum("net_condition"),
  hasRestrooms: boolean("has_restrooms").notNull().default(false),
  parkingInfo: text("parking_info"),
  bestTimes: text("best_times"),
  juniorNotes: text("junior_notes"),
  bookingUrl: varchar("booking_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Court = typeof courts.$inferSelect;
export type InsertCourt = typeof courts.$inferInsert;

// ── MatchRequest (supersedes simple hitRequests table) ────────────────────────

export const matchRequests = pgTable("match_requests", {
  id: serial("id").primaryKey(),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: matchRequestStatusEnum("status").notNull().default("PENDING"),
  proposedDate: timestamp("proposed_date").notNull(),
  /** "HH:MM" 24-hour */
  proposedStartTime: varchar("proposed_start_time", { length: 5 }).notNull(),
  proposedEndTime: varchar("proposed_end_time", { length: 5 }).notNull(),
  courtId: integer("court_id").references(() => courts.id, { onDelete: "set null" }),
  practiceType: varchar("practice_type").notNull(),
  costSplit: costSplitEnum("cost_split").notNull(),
  note: text("note"),
  /** Auto-set to createdAt + 48 hours */
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MatchRequest = typeof matchRequests.$inferSelect;
export type InsertMatchRequest = typeof matchRequests.$inferInsert;

// ── MatchSession ──────────────────────────────────────────────────────────────

export const matchSessions = pgTable("match_sessions", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => matchRequests.id, { onDelete: "cascade" }),
  player1Id: varchar("player1_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  player2Id: varchar("player2_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  courtId: integer("court_id").references(() => courts.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at").notNull(),
  practiceType: varchar("practice_type").notNull(),
  status: matchSessionStatusEnum("status").notNull().default("CONFIRMED"),
  player1CheckedInAt: timestamp("player1_checked_in_at"),
  player2CheckedInAt: timestamp("player2_checked_in_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type MatchSession = typeof matchSessions.$inferSelect;
export type InsertMatchSession = typeof matchSessions.$inferInsert;

// ── SessionRating ─────────────────────────────────────────────────────────────

export const sessionRatings = pgTable("session_ratings", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => matchSessions.id, { onDelete: "cascade" }),
  raterId: varchar("rater_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  ratedUserId: varchar("rated_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  /** 1–5 */
  reliability: integer("reliability").notNull(),
  /** 1–5 */
  skillAccuracy: integer("skill_accuracy").notNull(),
  /** 1–5 */
  partnerQuality: integer("partner_quality").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type SessionRating = typeof sessionRatings.$inferSelect;
export type InsertSessionRating = typeof sessionRatings.$inferInsert;

// ── Favorite ──────────────────────────────────────────────────────────────────

export const favorites = pgTable("favorites", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  favoriteUserId: varchar("favorite_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
});

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

// ── Relations ─────────────────────────────────────────────────────────────────

export const playerProfilesRelations = relations(playerProfiles, ({ one }) => ({
  user: one(users, { fields: [playerProfiles.userId], references: [users.id] }),
}));

export const weeklyAvailabilityRelations = relations(weeklyAvailability, ({ one }) => ({
  user: one(users, { fields: [weeklyAvailability.userId], references: [users.id] }),
}));

export const courtsRelations = relations(courts, ({ many }) => ({
  matchRequests: many(matchRequests),
  matchSessions: many(matchSessions),
}));

export const matchRequestsRelations = relations(matchRequests, ({ one }) => ({
  sender: one(users, { fields: [matchRequests.senderId], references: [users.id] }),
  receiver: one(users, { fields: [matchRequests.receiverId], references: [users.id] }),
  court: one(courts, { fields: [matchRequests.courtId], references: [courts.id] }),
  session: one(matchSessions, { fields: [matchRequests.id], references: [matchSessions.requestId] }),
}));

export const matchSessionsRelations = relations(matchSessions, ({ one, many }) => ({
  request: one(matchRequests, { fields: [matchSessions.requestId], references: [matchRequests.id] }),
  player1: one(users, { fields: [matchSessions.player1Id], references: [users.id] }),
  player2: one(users, { fields: [matchSessions.player2Id], references: [users.id] }),
  court: one(courts, { fields: [matchSessions.courtId], references: [courts.id] }),
  ratings: many(sessionRatings),
}));

export const sessionRatingsRelations = relations(sessionRatings, ({ one }) => ({
  session: one(matchSessions, { fields: [sessionRatings.sessionId], references: [matchSessions.id] }),
  rater: one(users, { fields: [sessionRatings.raterId], references: [users.id] }),
  ratedUser: one(users, { fields: [sessionRatings.ratedUserId], references: [users.id] }),
}));

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, { fields: [favorites.userId], references: [users.id] }),
  favoriteUser: one(users, { fields: [favorites.favoriteUserId], references: [users.id] }),
}));
