import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique().notNull(),
  passwordHash: varchar("password_hash").notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  dateOfBirth: varchar("date_of_birth"),
  zipCode: varchar("zip_code"),
  parentEmail: varchar("parent_email"),
  accountStatus: varchar("account_status").notNull().default("ACTIVE"),
  isAdmin: boolean("is_admin").notNull().default(false),
  guidelinesAcceptedAt: timestamp("guidelines_accepted_at"),
  // Invite / credits
  inviteCode: varchar("invite_code").unique(),
  referredBy: varchar("referred_by"),
  practiceCredits: integer("practice_credits").notNull().default(0),
  // Email preferences
  emailSessionReminders: boolean("email_session_reminders").notNull().default(true),
  emailReengagement: boolean("email_reengagement").notNull().default(true),
  emailMarketing: boolean("email_marketing").notNull().default(true),
  unsubscribeToken: varchar("unsubscribe_token").unique(),
  // Email verification
  emailVerificationToken: varchar("email_verification_token"),
  emailVerificationExpiry: timestamp("email_verification_expiry"),
  emailVerified: boolean("email_verified").default(false).notNull(),
  // Parent consent (under-18 users)
  parentApprovalToken: varchar("parent_approval_token"),
  parentApprovalSentAt: timestamp("parent_approval_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
