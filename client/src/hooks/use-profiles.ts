import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertProfile, type UpdateProfileRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useProfiles(filters?: { search?: string; minUtr?: string; maxUtr?: string }) {
  // Convert filters to query string params, removing undefined/empty
  const params: Record<string, string> = {};
  if (filters?.search) params.search = filters.search;
  if (filters?.minUtr) params.minUtr = filters.minUtr;
  if (filters?.maxUtr) params.maxUtr = filters.maxUtr;

  const queryString = new URLSearchParams(params).toString();
  const queryKey = [api.profiles.list.path, queryString];

  return useQuery({
    queryKey,
    queryFn: async () => {
      const url = `${api.profiles.list.path}?${queryString}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch profiles");
      return api.profiles.list.responses[200].parse(await res.json());
    },
  });
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: [api.profiles.get.path, userId],
    queryFn: async () => {
      if (!userId) return null;
      const url = buildUrl(api.profiles.get.path, { userId });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch profile");
      return api.profiles.get.responses[200].parse(await res.json());
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (updates: UpdateProfileRequest) => {
      // Input is partial, so we validate with partial schema
      const validated = api.profiles.update.input.parse(updates);
      const res = await fetch(api.profiles.update.path, {
        method: api.profiles.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.profiles.update.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to update profile");
      }
      return api.profiles.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.profiles.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.profiles.get.path, data.userId] });
      toast({
        title: "Profile Updated",
        description: "Your tennis profile has been saved successfully.",
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
