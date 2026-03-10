import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { CreateInteractionRequest, AnalyzeInteractionRequest } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// GET /api/interactions (optional filter by contactId)
export function useInteractions(contactId?: number) {
  return useQuery({
    queryKey: [api.interactions.list.path, { contactId }],
    queryFn: async () => {
      // Build query string manually since we don't have a helper for it in shared routes yet
      const url = new URL(api.interactions.list.path, window.location.origin);
      if (contactId) url.searchParams.append("contactId", contactId.toString());
      
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch interactions");
      return api.interactions.list.responses[200].parse(await res.json());
    },
  });
}

// POST /api/interactions
export function useCreateInteraction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateInteractionRequest) => {
      const res = await fetch(api.interactions.create.path, {
        method: api.interactions.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to log interaction");
      }
      return api.interactions.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.interactions.list.path] });
      // Invalidate specific contact interactions if we know the contactId
      if (variables.contactId) {
         queryClient.invalidateQueries({ queryKey: [api.interactions.list.path, { contactId: variables.contactId }] });
      }
      toast({ title: "Success", description: "Interaction logged successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// POST /api/analyze-interaction
export function useAnalyzeInteraction() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: AnalyzeInteractionRequest) => {
      const res = await fetch(api.interactions.analyze.path, {
        method: api.interactions.analyze.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to analyze text");
      }
      return api.interactions.analyze.responses[200].parse(await res.json());
    },
    onError: (error) => {
      toast({ title: "Analysis Failed", description: error.message, variant: "destructive" });
    },
  });
}
