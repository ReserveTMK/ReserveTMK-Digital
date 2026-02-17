import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Venue, Booking } from "@shared/schema";

export function useVenues() {
  return useQuery<Venue[]>({ queryKey: ['/api/venues'] });
}

export function useCreateVenue() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/venues', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/venues'] }),
  });
}

export function useUpdateVenue() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/venues/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/venues'] }),
  });
}

export function useDeleteVenue() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/venues/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/venues'] }),
  });
}

export function useBookings() {
  return useQuery<Booking[]>({ queryKey: ['/api/bookings'] });
}

export function useCreateBooking() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/bookings', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }),
  });
}

export function useUpdateBooking() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/bookings/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }),
  });
}

export function useDeleteBooking() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/bookings/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/bookings'] }),
  });
}
