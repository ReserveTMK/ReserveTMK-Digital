import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function useTaxonomy() {
  return useQuery<any[]>({ queryKey: ['/api/taxonomy'] });
}

export function useCreateTaxonomy() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/taxonomy', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/taxonomy'] });
    },
  });
}

export function useUpdateTaxonomy() {
  return useMutation({
    mutationFn: ({ id, ...data }: any) => apiRequest('PATCH', `/api/taxonomy/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/taxonomy'] });
    },
  });
}

export function useDeleteTaxonomy() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/taxonomy/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/taxonomy'] });
      queryClient.invalidateQueries({ queryKey: ['/api/keywords'] });
    },
  });
}

export function useKeywords() {
  return useQuery<any[]>({ queryKey: ['/api/keywords'] });
}

export function useCreateKeyword() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/keywords', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keywords'] });
    },
  });
}

export function useDeleteKeyword() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/keywords/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/keywords'] });
    },
  });
}
