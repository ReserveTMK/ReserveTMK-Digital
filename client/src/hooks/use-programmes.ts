import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Programme } from "@shared/schema";

export function useProgrammes() {
  return useQuery<Programme[]>({ queryKey: ['/api/programmes'] });
}

export function useProgramme(id: number) {
  return useQuery<Programme>({
    queryKey: ['/api/programmes', id],
    enabled: !!id,
  });
}

export function useCreateProgramme() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/programmes', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/programmes'] }),
  });
}

export function useUpdateProgramme() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/programmes/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/programmes'] }),
  });
}

export function useDeleteProgramme() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/programmes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/programmes'] }),
  });
}
