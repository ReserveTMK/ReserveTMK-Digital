import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Membership, Mou } from "@shared/schema";

export function useMemberships() {
  return useQuery<Membership[]>({ queryKey: ['/api/memberships'] });
}

export function useCreateMembership() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/memberships', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/memberships'] }),
  });
}

export function useUpdateMembership() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/memberships/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/memberships'] }),
  });
}

export function useDeleteMembership() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/memberships/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/memberships'] }),
  });
}

export function useMous() {
  return useQuery<Mou[]>({ queryKey: ['/api/mous'] });
}

export function useCreateMou() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/mous', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/mous'] }),
  });
}

export function useUpdateMou() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/mous/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/mous'] }),
  });
}

export function useDeleteMou() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/mous/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/mous'] }),
  });
}
