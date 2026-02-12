import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function useActionItems() {
  return useQuery({ queryKey: ['/api/action-items'] });
}

export function useCreateActionItem() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/action-items', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/action-items'] }),
  });
}

export function useUpdateActionItem() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/action-items/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/action-items'] }),
  });
}

export function useDeleteActionItem() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/action-items/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/action-items'] }),
  });
}
