import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export interface CreditNotification {
  id: number;
  userId: string;
  amount: number;
  reason: string;
  referredUserId: string | null;
  referredUserFirstName: string | null;
  notifiedAt: string | null;
  createdAt: string;
}

export function useCreditNotifications() {
  return useQuery<CreditNotification[]>({
    queryKey: ["/api/credits/notifications"],
    staleTime: 30_000,
  });
}

export function useMarkCreditsNotified() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      await apiRequest("POST", "/api/credits/notifications/mark-read", { ids });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/credits/notifications"] });
      qc.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
  });
}
