import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface CourtReviewStats {
  averageRating: number | null;
  totalReviews: number;
  netsGoodPct: number;
  surfaceCleanPct: number;
  notCrowdedPct: number;
  goodLightingPct: number;
  easyParkingPct: number;
  bestTimes: string | null;
  recentExcerpts: Array<{ note: string; overallRating: number; createdAt: string }>;
}

export interface CourtReviewPayload {
  overallRating: number;
  netsGood: boolean;
  surfaceClean: boolean;
  notCrowded: boolean;
  goodLighting: boolean;
  easyParking: boolean;
  note: string;
  firstTime: boolean;
}

export function useCourtReviewStats(courtId: number | null | undefined, enabled = true) {
  return useQuery<CourtReviewStats>({
    queryKey: ["/api/courts", courtId, "reviews"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/courts/${courtId}/reviews`);
      return res.json();
    },
    enabled: enabled && !!courtId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useMyCourtReview(sessionId: number) {
  return useQuery({
    queryKey: ["/api/sessions", sessionId, "my-court-review"],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}/my-court-review`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json() as Promise<object | null>;
    },
    enabled: !!sessionId,
  });
}

export function useSubmitCourtReview(sessionId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CourtReviewPayload) => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/review-court`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "my-court-review"] });
    },
    onError: (err: any) => {
      toast({ title: err.message ?? "Failed to submit review", variant: "destructive" });
    },
  });
}
