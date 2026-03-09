import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Venue, Booking, BookingPricingDefaults, RegularBooker, VenueInstruction } from "@shared/schema";

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

export function useBookingPricingDefaults() {
  return useQuery<BookingPricingDefaults>({ queryKey: ['/api/booking-pricing-defaults'] });
}

export function useUpdateBookingPricingDefaults() {
  return useMutation({
    mutationFn: (data: { fullDayRate?: string; halfDayRate?: string }) =>
      apiRequest('PUT', '/api/booking-pricing-defaults', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/booking-pricing-defaults'] }),
  });
}

export function useRegularBookers() {
  return useQuery<RegularBooker[]>({ queryKey: ['/api/regular-bookers'] });
}

export function useCreateRegularBooker() {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest('POST', '/api/regular-bookers', data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/regular-bookers'] }),
  });
}

export function useUpdateRegularBooker() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/regular-bookers/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/regular-bookers'] }),
  });
}

export function useDeleteRegularBooker() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/regular-bookers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/regular-bookers'] }),
  });
}

export function useVenueInstructions() {
  return useQuery<VenueInstruction[]>({ queryKey: ['/api/venue-instructions'] });
}

export function useCreateVenueInstruction() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/venue-instructions', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/venue-instructions'] }),
  });
}

export function useUpdateVenueInstruction() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/venue-instructions/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/venue-instructions'] }),
  });
}

export function useDeleteVenueInstruction() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/venue-instructions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/venue-instructions'] }),
  });
}

export function useAllBookerLinks() {
  return useQuery<any[]>({ queryKey: ['/api/all-booker-links'] });
}
