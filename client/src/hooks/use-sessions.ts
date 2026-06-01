import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useSession(id: number) {
  return useQuery({
    queryKey: ["/api/sessions", id],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
    enabled: !!id,
    // Poll every 15s during the 30-min pre-session + 2h post-start check-in window
    refetchInterval: (query) => {
      const data = query.state.data as any;
      if (!data?.scheduledTime || data.status !== "accepted") return false;
      const t = new Date(data.scheduledTime).getTime();
      const now = Date.now();
      if (t - now > 30 * 60_000) return false;   // too far away
      if (now - t > 2 * 3600_000) return false;   // more than 2h past
      return 15_000;
    },
  });
}

export function useUpcomingSessions() {
  return useQuery({
    queryKey: ["/api/sessions/upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/sessions/upcoming", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load upcoming sessions");
      return res.json();
    },
  });
}

export function useSessionMessages(sessionId: number) {
  return useQuery({
    queryKey: ["/api/sessions", sessionId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: 30_000,
  });
}

export function useSendSessionMessage(sessionId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "messages"] });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    },
  });
}

export function useCheckin(sessionId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (locationVerified: boolean) => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/checkin`, { locationVerified });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
    },
    onError: (err: any) => {
      toast({ title: err.message ?? "Check-in failed", variant: "destructive" });
    },
  });
}

export function useMarkNoShow(sessionId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/no-show`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
      toast({ title: "No-show recorded" });
    },
    onError: (err: any) => {
      toast({ title: err.message ?? "Failed to record no-show", variant: "destructive" });
    },
  });
}

export function useMyRating(sessionId: number) {
  return useQuery({
    queryKey: ["/api/sessions", sessionId, "my-rating"],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}/my-rating`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load rating");
      return res.json();
    },
    enabled: !!sessionId,
  });
}

export function useSubmitRating(sessionId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { reliability: number; skillAccuracy: number; partnerQuality: number; note?: string | null }) => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/rate`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId, "my-rating"] });
    },
    onError: (err: any) => {
      toast({ title: err.message ?? "Failed to submit rating", variant: "destructive" });
    },
  });
}

export function useCancelSession(sessionId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", `/api/sessions/${sessionId}/cancel`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["/api/hit-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/upcoming"] });
      toast({ title: "Session cancelled" });
    },
    onError: () => {
      toast({ title: "Failed to cancel session", variant: "destructive" });
    },
  });
}
