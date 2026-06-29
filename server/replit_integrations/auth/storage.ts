import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { and, eq, isNotNull, lte, gte } from "drizzle-orm";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByInviteCode(code: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  setEmailVerificationToken(userId: string, token: string, expiry: Date): Promise<void>;
  getUserByEmailVerificationToken(token: string): Promise<User | undefined>;
  verifyEmail(userId: string, newStatus: string): Promise<void>;
  setParentApprovalToken(userId: string, token: string): Promise<void>;
  getUserByParentApprovalToken(token: string): Promise<User | undefined>;
  approveAccount(userId: string): Promise<void>;
  getUsersPendingParentReminder(): Promise<User[]>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByInviteCode(code: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.inviteCode, code.toUpperCase()));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();
    return user;
  }

  async setEmailVerificationToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db
      .update(users)
      .set({ emailVerificationToken: token, emailVerificationExpiry: expiry })
      .where(eq(users.id, userId));
  }

  async getUserByEmailVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailVerificationToken, token));
    return user;
  }

  async verifyEmail(userId: string, newStatus: string): Promise<void> {
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
        accountStatus: newStatus,
      })
      .where(eq(users.id, userId));
  }

  async setParentApprovalToken(userId: string, token: string): Promise<void> {
    await db
      .update(users)
      .set({ parentApprovalToken: token, parentApprovalSentAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getUserByParentApprovalToken(token: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.parentApprovalToken, token));
    return user;
  }

  async approveAccount(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ accountStatus: "ACTIVE", parentApprovalToken: null })
      .where(eq(users.id, userId));
  }

  // Returns under-18 users whose parent approval email was sent 48–72 hours ago
  // with no approval yet — used by the reminder cron job.
  async getUsersPendingParentReminder(): Promise<User[]> {
    const now = new Date();
    const cutoffStart = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const cutoffEnd = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    return db
      .select()
      .from(users)
      .where(
        and(
          eq(users.accountStatus, "PENDING_PARENT"),
          isNotNull(users.parentApprovalSentAt),
          gte(users.parentApprovalSentAt, cutoffStart),
          lte(users.parentApprovalSentAt, cutoffEnd)
        )
      );
  }
}

export const authStorage = new AuthStorage();
