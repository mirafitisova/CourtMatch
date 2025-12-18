import { db } from "./db";
import {
  profiles, hitRequests,
  type Profile, type InsertProfile, type UpdateProfileRequest,
  type HitRequest, type InsertHitRequest, type UpdateHitRequestStatus,
  type ProfileWithUser, type HitRequestWithProfiles
} from "@shared/schema";
import { users } from "@shared/models/auth"; // Import auth schema directly
import { eq, or, and, desc, ilike, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Profiles
  getProfile(userId: string): Promise<ProfileWithUser | undefined>;
  getProfiles(filters?: { search?: string, minUtr?: number, maxUtr?: number }): Promise<ProfileWithUser[]>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: string, updates: UpdateProfileRequest): Promise<Profile>;

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
    return { ...result[0].profile, user: result[0].user };
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
    return results.map(r => ({ ...r.profile, user: r.user }));
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

  async updateHitRequestStatus(id: number, status: string): Promise<HitRequest | undefined> {
    const [updated] = await db.update(hitRequests)
      .set({ status })
      .where(eq(hitRequests.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
