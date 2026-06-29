import { db } from "./db";
import {
  profiles, hitRequests, sessionMessages, hitRequestRatings,
  type Profile, type InsertProfile, type UpdateProfileRequest,
  type HitRequest, type InsertHitRequest, type UpdateHitRequestStatus,
  type ProfileWithUser, type HitRequestWithProfiles, type SessionMessage,
  type HitRequestRating,
} from "@shared/schema";
import {
  playerProfiles, weeklyAvailability, courts,
  type PlayerProfile, type InsertPlayerProfile,
  type WeeklyAvailability, type InsertWeeklyAvailability,
} from "@shared/models/tennis";
import { users } from "@shared/models/auth";
import { eq, or, and, desc, gte, lte, isNull, isNotNull, count } from "drizzle-orm";
import { calculateStreak } from "@shared/lib/stats";

export interface PlayerStats {
  streak: number;
  sessionsThisMonth: number;
  totalSessions: number;
  mostFrequentPracticeType: string | null;
  mostFrequentCourtId: number | null;
  mostFrequentCourtName: string | null;
  mostFrequentPartnerId: string | null;
  mostFrequentPartnerFirstName: string | null;
  mostFrequentPartnerLastName: string | null;
  avgRating: number | null;
  memberSince: Date | null;
}

export interface RatingSnapshot {
  reliability: number;
  skillAccuracy: number;
  partnerQuality: number;
  note: string | null;
}

export interface SessionHistoryItem {
  id: number;
  scheduledTime: Date | null;
  practiceType: string | null;
  location: string | null;
  courtId: number | null;
  courtName: string | null;
  partnerId: string;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  myRating: RatingSnapshot | null;
  theirRating: RatingSnapshot | null;
}

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
  updateHitRequestStatus(id: number, status: string, extra?: HitRequestExtra): Promise<HitRequest | undefined>;

  // Sessions
  getSessionDetail(id: number): Promise<SessionDetail | undefined>;
  getUpcomingSessions(userId: string): Promise<SessionWithPartner[]>;
  getSessionsForReminder(windowStart: Date, windowEnd: Date, type: '24h' | '1h'): Promise<HitRequest[]>;
  markReminderSent(id: number, type: '24h' | '1h'): Promise<void>;

  // Session messages
  getSessionMessages(hitRequestId: number): Promise<SessionMessageWithSender[]>;
  createSessionMessage(hitRequestId: number, senderId: string, content: string): Promise<SessionMessage>;

  // Check-in
  checkinSession(id: number, isRequester: boolean, locationVerified: boolean): Promise<HitRequest | undefined>;
  markNoShow(id: number, noShowUserId: string): Promise<HitRequest | undefined>;
  incrementNoShowCount(userId: string): Promise<void>;

  // Ratings
  submitRating(hitRequestId: number, raterId: string, ratedUserId: string, data: { reliability: number; skillAccuracy: number; partnerQuality: number; note?: string | null }): Promise<HitRequestRating>;
  getMyRating(hitRequestId: number, raterId: string): Promise<HitRequestRating | undefined>;
  recalculatePlayerRating(userId: string): Promise<void>;
  getSessionsForRatingNotification(windowStart: Date, windowEnd: Date): Promise<HitRequest[]>;
  markRatingNotificationSent(id: number): Promise<void>;

  // Stats
  getPlayerStats(userId: string): Promise<PlayerStats>;
  getSessionHistory(userId: string): Promise<SessionHistoryItem[]>;
  getPublicStats(): Promise<{ playerCount: number; sessionCount: number; courtCount: number }>;
}

export interface HitRequestExtra {
  scheduledTime?: Date;
  location?: string;
  courtId?: number;
  practiceType?: string;
  costSplit?: string;
  cancelReason?: string;
  reminder24hSentAt?: Date;
  reminder1hSentAt?: Date;
}

export interface SessionPlayerInfo {
  user: { firstName: string | null; lastName: string | null; email: string | null; parentEmail: string | null; dateOfBirth: string | null } | null;
  profile: PlayerProfile | null;
}

export interface SessionDetail extends HitRequest {
  court: typeof courts.$inferSelect | null;
  requester: SessionPlayerInfo;
  receiver: SessionPlayerInfo;
}

export interface SessionWithPartner extends HitRequest {
  court: typeof courts.$inferSelect | null;
  partner: { user: { firstName: string | null; lastName: string | null } | null; profile: PlayerProfile | null };
}

export interface SessionMessageWithSender extends SessionMessage {
  senderFirstName: string | null;
  senderLastName: string | null;
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

  async updateHitRequestStatus(id: number, status: string, extra?: HitRequestExtra): Promise<HitRequest | undefined> {
    const updates: Partial<HitRequest> = { status };
    if (extra?.scheduledTime) updates.scheduledTime = extra.scheduledTime;
    if (extra?.location) updates.location = extra.location;
    if (extra?.courtId !== undefined) updates.courtId = extra.courtId;
    if (extra?.practiceType) updates.practiceType = extra.practiceType;
    if (extra?.costSplit) updates.costSplit = extra.costSplit;
    if (extra?.cancelReason !== undefined) updates.cancelReason = extra.cancelReason;
    if (extra?.reminder24hSentAt) updates.reminder24hSentAt = extra.reminder24hSentAt;
    if (extra?.reminder1hSentAt) updates.reminder1hSentAt = extra.reminder1hSentAt;
    const [updated] = await db.update(hitRequests).set(updates).where(eq(hitRequests.id, id)).returning();
    return updated;
  }

  async getSessionDetail(id: number): Promise<SessionDetail | undefined> {
    const [req] = await db.select().from(hitRequests).where(eq(hitRequests.id, id)).limit(1);
    if (!req) return undefined;

    const [[requesterUser], [receiverUser], requesterProfile, receiverProfile] = await Promise.all([
      db.select({
        firstName: users.firstName, lastName: users.lastName,
        email: users.email, parentEmail: users.parentEmail, dateOfBirth: users.dateOfBirth,
      }).from(users).where(eq(users.id, req.requesterId)).limit(1),
      db.select({
        firstName: users.firstName, lastName: users.lastName,
        email: users.email, parentEmail: users.parentEmail, dateOfBirth: users.dateOfBirth,
      }).from(users).where(eq(users.id, req.receiverId)).limit(1),
      this.getPlayerProfile(req.requesterId),
      this.getPlayerProfile(req.receiverId),
    ]);

    const court = req.courtId
      ? await db.select().from(courts).where(eq(courts.id, req.courtId)).limit(1).then(r => r[0] ?? null)
      : null;

    return {
      ...req,
      court,
      requester: { user: requesterUser ?? null, profile: requesterProfile ?? null },
      receiver: { user: receiverUser ?? null, profile: receiverProfile ?? null },
    };
  }

  async getUpcomingSessions(userId: string): Promise<SessionWithPartner[]> {
    const now = new Date();
    const rows = await db.select().from(hitRequests).where(
      and(
        or(eq(hitRequests.requesterId, userId), eq(hitRequests.receiverId, userId)),
        eq(hitRequests.status, 'accepted'),
        isNotNull(hitRequests.scheduledTime),
        gte(hitRequests.scheduledTime, now),
      )
    ).orderBy(hitRequests.scheduledTime).limit(5);

    return Promise.all(rows.map(async (req) => {
      const isRequester = req.requesterId === userId;
      const partnerId = isRequester ? req.receiverId : req.requesterId;
      const [[partnerUser], partnerProfile, court] = await Promise.all([
        db.select({ firstName: users.firstName, lastName: users.lastName })
          .from(users).where(eq(users.id, partnerId)).limit(1),
        this.getPlayerProfile(partnerId),
        req.courtId
          ? db.select().from(courts).where(eq(courts.id, req.courtId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
      ]);
      return { ...req, partner: { user: partnerUser ?? null, profile: partnerProfile ?? null }, court };
    }));
  }

  async getSessionsForReminder(windowStart: Date, windowEnd: Date, type: '24h' | '1h'): Promise<HitRequest[]> {
    const sentCol = type === '24h' ? hitRequests.reminder24hSentAt : hitRequests.reminder1hSentAt;
    return db.select().from(hitRequests).where(
      and(
        eq(hitRequests.status, 'accepted'),
        isNotNull(hitRequests.scheduledTime),
        gte(hitRequests.scheduledTime, windowStart),
        lte(hitRequests.scheduledTime, windowEnd),
        isNull(sentCol),
      )
    );
  }

  async markReminderSent(id: number, type: '24h' | '1h'): Promise<void> {
    const field = type === '24h'
      ? { reminder24hSentAt: new Date() }
      : { reminder1hSentAt: new Date() };
    await db.update(hitRequests).set(field).where(eq(hitRequests.id, id));
  }

  async getSessionMessages(hitRequestId: number): Promise<SessionMessageWithSender[]> {
    const rows = await db.select({
      id: sessionMessages.id,
      hitRequestId: sessionMessages.hitRequestId,
      senderId: sessionMessages.senderId,
      content: sessionMessages.content,
      createdAt: sessionMessages.createdAt,
      senderFirstName: users.firstName,
      senderLastName: users.lastName,
    })
    .from(sessionMessages)
    .leftJoin(users, eq(sessionMessages.senderId, users.id))
    .where(eq(sessionMessages.hitRequestId, hitRequestId))
    .orderBy(sessionMessages.createdAt);
    return rows;
  }

  async createSessionMessage(hitRequestId: number, senderId: string, content: string): Promise<SessionMessage> {
    const [msg] = await db.insert(sessionMessages).values({ hitRequestId, senderId, content }).returning();
    return msg;
  }

  async checkinSession(id: number, isRequester: boolean, locationVerified: boolean): Promise<HitRequest | undefined> {
    const fields = isRequester
      ? { checkinRequesterAt: new Date(), checkinRequesterLocationVerified: locationVerified }
      : { checkinReceiverAt: new Date(), checkinReceiverLocationVerified: locationVerified };
    const [updated] = await db.update(hitRequests).set(fields).where(eq(hitRequests.id, id)).returning();
    return updated;
  }

  async markNoShow(id: number, noShowUserId: string): Promise<HitRequest | undefined> {
    const [updated] = await db
      .update(hitRequests)
      .set({ status: "no_show", noShowUserId })
      .where(eq(hitRequests.id, id))
      .returning();
    return updated;
  }

  async incrementNoShowCount(userId: string): Promise<void> {
    const existing = await this.getPlayerProfile(userId);
    if (existing) {
      await db
        .update(playerProfiles)
        .set({ noShowCount: (existing.noShowCount ?? 0) + 1 })
        .where(eq(playerProfiles.userId, userId));
    }
  }

  async submitRating(hitRequestId: number, raterId: string, ratedUserId: string, data: { reliability: number; skillAccuracy: number; partnerQuality: number; note?: string | null }): Promise<HitRequestRating> {
    const [rating] = await db.insert(hitRequestRatings)
      .values({ hitRequestId, raterId, ratedUserId, ...data })
      .returning();
    return rating;
  }

  async getMyRating(hitRequestId: number, raterId: string): Promise<HitRequestRating | undefined> {
    const [row] = await db.select().from(hitRequestRatings)
      .where(and(eq(hitRequestRatings.hitRequestId, hitRequestId), eq(hitRequestRatings.raterId, raterId)))
      .limit(1);
    return row;
  }

  async recalculatePlayerRating(userId: string): Promise<void> {
    const ratings = await db.select().from(hitRequestRatings).where(eq(hitRequestRatings.ratedUserId, userId));
    const count = ratings.length;
    if (count === 0) {
      await db.update(playerProfiles).set({ sessionCount: 0, avgRating: null }).where(eq(playerProfiles.userId, userId));
      return;
    }
    const total = ratings.reduce((sum, r) => sum + r.reliability + r.skillAccuracy + r.partnerQuality, 0);
    const avg = Math.round((total / (count * 3)) * 10) / 10;
    await db.update(playerProfiles).set({ sessionCount: count, avgRating: avg }).where(eq(playerProfiles.userId, userId));
  }

  async getSessionsForRatingNotification(windowStart: Date, windowEnd: Date): Promise<HitRequest[]> {
    return db.select().from(hitRequests).where(
      and(
        eq(hitRequests.status, 'accepted'),
        isNotNull(hitRequests.scheduledTime),
        gte(hitRequests.scheduledTime, windowStart),
        lte(hitRequests.scheduledTime, windowEnd),
        isNull(hitRequests.ratingNotifiedAt),
      )
    );
  }

  async markRatingNotificationSent(id: number): Promise<void> {
    await db.update(hitRequests).set({ ratingNotifiedAt: new Date() }).where(eq(hitRequests.id, id));
  }

  async getPublicStats(): Promise<{ playerCount: number; sessionCount: number; courtCount: number }> {
    const [players, sessions, courtList] = await Promise.all([
      db.select({ n: count() }).from(profiles),
      db.select({ n: count() }).from(hitRequests).where(eq(hitRequests.status, 'completed')),
      db.select({ n: count() }).from(courts),
    ]);
    return {
      playerCount: players[0]?.n ?? 0,
      sessionCount: sessions[0]?.n ?? 0,
      courtCount: courtList[0]?.n ?? 0,
    };
  }

  async getPlayerStats(userId: string): Promise<PlayerStats> {
    const [completedSessions, userRow, profileRow] = await Promise.all([
      db.select()
        .from(hitRequests)
        .where(and(
          or(eq(hitRequests.requesterId, userId), eq(hitRequests.receiverId, userId)),
          eq(hitRequests.status, 'completed'),
        )),
      db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1),
      db.select({ avgRating: playerProfiles.avgRating }).from(playerProfiles).where(eq(playerProfiles.userId, userId)).limit(1),
    ]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const sessionDates = completedSessions
      .filter(s => s.scheduledTime != null)
      .map(s => s.scheduledTime!);

    const sessionsThisMonth = completedSessions.filter(
      s => s.scheduledTime && new Date(s.scheduledTime) >= monthStart,
    ).length;

    // Most frequent practice type
    const practiceMap = new Map<string, number>();
    const courtMap = new Map<number, number>();
    const partnerMap = new Map<string, number>();
    for (const s of completedSessions) {
      if (s.practiceType) practiceMap.set(s.practiceType, (practiceMap.get(s.practiceType) ?? 0) + 1);
      if (s.courtId) courtMap.set(s.courtId, (courtMap.get(s.courtId) ?? 0) + 1);
      const pid = s.requesterId === userId ? s.receiverId : s.requesterId;
      partnerMap.set(pid, (partnerMap.get(pid) ?? 0) + 1);
    }

    const topPracticeType = practiceMap.size > 0
      ? [...practiceMap.entries()].sort((a, b) => b[1] - a[1])[0][0]
      : null;

    let mostFrequentCourtId: number | null = null;
    let mostFrequentCourtName: string | null = null;
    if (courtMap.size > 0) {
      mostFrequentCourtId = [...courtMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const [court] = await db.select({ name: courts.name }).from(courts).where(eq(courts.id, mostFrequentCourtId)).limit(1);
      mostFrequentCourtName = court?.name ?? null;
    }

    let mostFrequentPartnerId: string | null = null;
    let mostFrequentPartnerFirstName: string | null = null;
    let mostFrequentPartnerLastName: string | null = null;
    if (partnerMap.size > 0) {
      mostFrequentPartnerId = [...partnerMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const [pu] = await db.select({ firstName: users.firstName, lastName: users.lastName })
        .from(users).where(eq(users.id, mostFrequentPartnerId)).limit(1);
      mostFrequentPartnerFirstName = pu?.firstName ?? null;
      mostFrequentPartnerLastName = pu?.lastName ?? null;
    }

    return {
      streak: calculateStreak(sessionDates),
      sessionsThisMonth,
      totalSessions: completedSessions.length,
      mostFrequentPracticeType: topPracticeType,
      mostFrequentCourtId,
      mostFrequentCourtName,
      mostFrequentPartnerId,
      mostFrequentPartnerFirstName,
      mostFrequentPartnerLastName,
      avgRating: profileRow[0]?.avgRating ?? null,
      memberSince: userRow[0]?.createdAt ?? null,
    };
  }

  async getSessionHistory(userId: string): Promise<SessionHistoryItem[]> {
    const sessions = await db.select()
      .from(hitRequests)
      .where(and(
        or(eq(hitRequests.requesterId, userId), eq(hitRequests.receiverId, userId)),
        eq(hitRequests.status, 'completed'),
      ))
      .orderBy(desc(hitRequests.scheduledTime));

    return Promise.all(sessions.map(async (s) => {
      const partnerId = s.requesterId === userId ? s.receiverId : s.requesterId;

      const [[partnerUser], court, myRatingRow, theirRatingRow] = await Promise.all([
        db.select({ firstName: users.firstName, lastName: users.lastName })
          .from(users).where(eq(users.id, partnerId)).limit(1),
        s.courtId
          ? db.select({ name: courts.name }).from(courts).where(eq(courts.id, s.courtId)).limit(1).then(r => r[0] ?? null)
          : Promise.resolve(null),
        db.select().from(hitRequestRatings)
          .where(and(eq(hitRequestRatings.hitRequestId, s.id), eq(hitRequestRatings.raterId, userId)))
          .limit(1).then(r => r[0] ?? null),
        db.select().from(hitRequestRatings)
          .where(and(eq(hitRequestRatings.hitRequestId, s.id), eq(hitRequestRatings.raterId, partnerId)))
          .limit(1).then(r => r[0] ?? null),
      ]);

      const toSnapshot = (r: typeof myRatingRow): RatingSnapshot | null =>
        r ? { reliability: r.reliability, skillAccuracy: r.skillAccuracy, partnerQuality: r.partnerQuality, note: r.note } : null;

      return {
        id: s.id,
        scheduledTime: s.scheduledTime,
        practiceType: s.practiceType,
        location: s.location,
        courtId: s.courtId,
        courtName: (court as any)?.name ?? null,
        partnerId,
        partnerFirstName: partnerUser?.firstName ?? null,
        partnerLastName: partnerUser?.lastName ?? null,
        myRating: toSnapshot(myRatingRow),
        theirRating: toSnapshot(theirRatingRow),
      };
    }));
  }
}

export const storage = new DatabaseStorage();
