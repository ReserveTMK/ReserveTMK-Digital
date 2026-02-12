import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function useImpactLogs() {
  return useQuery({ queryKey: ['/api/impact-logs'] });
}

export function useImpactLog(id: number | undefined) {
  return useQuery({
    queryKey: ['/api/impact-logs', id],
    enabled: !!id,
  });
}

export function useCreateImpactLog() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/impact-logs', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/impact-logs'] }),
  });
}

export function useUpdateImpactLog() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/impact-logs/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/impact-logs'] }),
  });
}
