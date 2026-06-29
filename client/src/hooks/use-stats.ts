import { useQuery } from "@tanstack/react-query";

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
  memberSince: string | null;
}

export interface RatingSnapshot {
  reliability: number;
  skillAccuracy: number;
  partnerQuality: number;
  note: string | null;
}

export interface SessionHistoryItem {
  id: number;
  scheduledTime: string | null;
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

export function useMyStats() {
  return useQuery<PlayerStats>({
    queryKey: ["/api/stats/me"],
  });
}

export function usePlayerStats(userId: string) {
  return useQuery<PlayerStats>({
    queryKey: ["/api/stats", userId],
    enabled: !!userId,
  });
}

export function useSessionHistory() {
  return useQuery<SessionHistoryItem[]>({
    queryKey: ["/api/sessions/history"],
  });
}
