import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertHitRequest, type UpdateHitRequestStatus } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useHitRequests() {
  return useQuery({
    queryKey: [api.hitRequests.list.path],
    queryFn: async () => {
      const res = await fetch(api.hitRequests.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hit requests");
      return api.hitRequests.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateHitRequest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertHitRequest) => {
      const validated = api.hitRequests.create.input.parse(data);
      const res = await fetch(api.hitRequests.create.path, {
        method: api.hitRequests.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.hitRequests.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create hit request");
      }
      return api.hitRequests.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.hitRequests.list.path] });
      toast({
        title: "Request Sent!",
        description: "Your hitting request has been sent to the player.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to send request",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateHitRequestStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: number } & UpdateHitRequestStatus) => {
      const validated = api.hitRequests.updateStatus.input.parse({ status });
      const url = buildUrl(api.hitRequests.updateStatus.path, { id });
      
      const res = await fetch(url, {
        method: api.hitRequests.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 404) throw new Error("Request not found");
        throw new Error("Failed to update status");
      }
      return api.hitRequests.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.hitRequests.list.path] });
      toast({
        title: "Status Updated",
        description: "The hit request status has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
