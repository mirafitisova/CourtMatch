import { db } from "./db";
import {
  profiles, hitRequests,
  type Profile, type InsertProfile, type UpdateProfileRequest,
  type HitRequest, type InsertHitRequest, type UpdateHitRequestStatus,
  type ProfileWithUser, type HitRequestWithProfiles
} from "@shared/schema";
import {
  playerProfiles, weeklyAvailability,
  type PlayerProfile, type InsertPlayerProfile,
  type WeeklyAvailability, type InsertWeeklyAvailability,
} from "@shared/models/tennis";
import { users } from "@shared/models/auth"; // Import auth schema directly
import { eq, or, and, desc, ilike, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Profiles
  getProfile(userId: string): Promise<ProfileWithUser | undefined>;
  getProfiles(filters?: { search?: string, minUtr?: number, maxUtr?: number }): Promise<ProfileWithUser[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: string, updates: UpdateProfileRequest): Promise<Profile>;

  // Player Profiles (extended tennis schema)
  getPlayerProfile(userId: string): Promise<PlayerProfile | undefined>;
  upsertPlayerProfile(userId: string, data: Partial<InsertPlayerProfile>): Promise<PlayerProfile>;

  // Weekly Availability
  getWeeklyAvailability(userId: string): Promise<WeeklyAvailability[]>;
  replaceWeeklyAvailability(userId: string, slots: Omit<InsertWeeklyAvailability, "userId">[]): Promise<WeeklyAvailability[]>;

  // Hit Requests
  getHitRequests(userId: string): Promise<HitRequestWithProfiles[]>;
  createHitRequest(request: InsertHitRequest): Promise<HitRequest>;
  updateHitRequestStatus(id: number, status: string): Promise<HitRequest | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getProfile(userId: string): Promise<ProfileWithUser | undefined> {
    // Join with auth user table to get names/images
    const result = await db.select({
      profile: profiles,
      user: {
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl
      }
    })
    .from(profiles)
    .leftJoin(users, eq(profiles.userId, users.id))
    .where(eq(profiles.userId, userId))
    .limit(1);

    if (result.length === 0) return undefined;
    return { ...result[0].profile, user: result[0].user ?? undefined };
  }

  async getProfiles(filters?: { search?: string, minUtr?: number, maxUtr?: number }): Promise<ProfileWithUser[]> {
    let query = db.select({
      profile: profiles,
      user: {
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl
      }
    })
    .from(profiles)
    .leftJoin(users, eq(profiles.userId, users.id));

    // Basic filtering (UTR, Search) implementation
    // Ideally use more complex WHERE conditions based on filters
    const conditions = [];
    if (filters?.minUtr) conditions.push(gte(profiles.utrRating, filters.minUtr));
    if (filters?.maxUtr) conditions.push(lte(profiles.utrRating, filters.maxUtr));
    // Search by user name or location could be added here if needed, requires more complex joins/filters

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const results = await query;
    return results.map(r => ({ ...r.profile, user: r.user ?? undefined }));
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [newProfile] = await db.insert(profiles).values(profile).returning();
    return newProfile;
  }

  async updateProfile(userId: string, updates: UpdateProfileRequest): Promise<Profile> {
    // Check if profile exists, if not create it
    const existing = await this.getProfile(userId);
    if (!existing) {
       return this.createProfile({ ...updates, userId } as InsertProfile);
    }

    const [updated] = await db.update(profiles)
      .set(updates)
      .where(eq(profiles.userId, userId))
      .returning();
    return updated;
  }

  async getPlayerProfile(userId: string): Promise<PlayerProfile | undefined> {
    const [row] = await db.select()
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, userId))
      .limit(1);
    return row;
  }

  async upsertPlayerProfile(userId: string, data: Partial<InsertPlayerProfile>): Promise<PlayerProfile> {
    const existing = await this.getPlayerProfile(userId);
    if (!existing) {
      const [created] = await db.insert(playerProfiles)
        .values({ ...data, userId } as InsertPlayerProfile)
        .returning();
      return created;
    }
    const [updated] = await db.update(playerProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(playerProfiles.userId, userId))
      .returning();
    return updated;
  }

  async getWeeklyAvailability(userId: string): Promise<WeeklyAvailability[]> {
    return db.select().from(weeklyAvailability).where(eq(weeklyAvailability.userId, userId));
  }

  async replaceWeeklyAvailability(
    userId: string,
    slots: Omit<InsertWeeklyAvailability, "userId">[],
  ): Promise<WeeklyAvailability[]> {
    await db.delete(weeklyAvailability).where(eq(weeklyAvailability.userId, userId));
    if (slots.length === 0) return [];
    const rows = await db
      .insert(weeklyAvailability)
      .values(slots.map((s) => ({ ...s, userId })))
      .returning();
    return rows;
  }

  async getHitRequests(userId: string): Promise<HitRequestWithProfiles[]> {
    const requests = await db.select()
      .from(hitRequests)
      .where(or(eq(hitRequests.requesterId, userId), eq(hitRequests.receiverId, userId)))
      .orderBy(desc(hitRequests.createdAt));
    
    // Enrich with profiles (inefficient N+1 but fine for MVP/low scale)
    const enriched = await Promise.all(requests.map(async (req) => {
        const requester = await this.getProfile(req.requesterId);
        const receiver = await this.getProfile(req.receiverId);
        return { ...req, requester, receiver };
    }));
    
    return enriched;
  }

  async createHitRequest(request: InsertHitRequest): Promise<HitRequest> {
    const [newRequest] = await db.insert(hitRequests).values(request).returning();
    return newRequest;
  }

  async updateHitRequestStatus(id: number, status: string, scheduling?: { scheduledTime?: Date; location?: string }): Promise<HitRequest | undefined> {
    const updates: Partial<HitRequest> = { status };
    if (scheduling?.scheduledTime) updates.scheduledTime = scheduling.scheduledTime;
    if (scheduling?.location) updates.location = scheduling.location;
    const [updated] = await db.update(hitRequests)
      .set(updates)
      .where(eq(hitRequests.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
