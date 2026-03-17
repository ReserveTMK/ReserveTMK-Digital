import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Venue, Booking, BookingPricingDefaults, RegularBooker, VenueInstruction, BookableResource, DeskBooking, GearBooking } from "@shared/schema";

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
    mutationFn: (data: { fullDayRate?: string; halfDayRate?: string; maxAdvanceMonths?: number }) =>
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

export function useVenueInstructions(venueId?: number | null) {
  const params = venueId !== undefined ? `?venueId=${venueId}` : '';
  return useQuery<VenueInstruction[]>({ queryKey: ['/api/venue-instructions', venueId], queryFn: () => fetch(`/api/venue-instructions${params}`, { credentials: 'include' }).then(r => r.json()) });
}

export function useCreateVenueInstruction() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/venue-instructions', data),
    onSuccess: () => queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.('/api/venue-instructions') || query.queryKey[0] === '/api/venue-instructions' }),
  });
}

export function useUpdateVenueInstruction() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/venue-instructions/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.('/api/venue-instructions') || query.queryKey[0] === '/api/venue-instructions' }),
  });
}

export function useDeleteVenueInstruction() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/venue-instructions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.startsWith?.('/api/venue-instructions') || query.queryKey[0] === '/api/venue-instructions' }),
  });
}

export function useAllBookerLinks() {
  return useQuery<any[]>({ queryKey: ['/api/all-booker-links'] });
}

export function useBookableResources(category?: string) {
  const url = category ? `/api/bookable-resources?category=${category}` : '/api/bookable-resources';
  return useQuery<BookableResource[]>({
    queryKey: ['/api/bookable-resources', category],
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useCreateBookableResource() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/bookable-resources', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/bookable-resources'] }),
  });
}

export function useUpdateBookableResource() {
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PATCH', `/api/bookable-resources/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/bookable-resources'] }),
  });
}

export function useDeleteBookableResource() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/bookable-resources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/bookable-resources'] }),
  });
}

export function useDeskBookings(dateRange?: { start: string; end: string }) {
  const url = dateRange ? `/api/desk-bookings?startDate=${dateRange.start}&endDate=${dateRange.end}` : '/api/desk-bookings';
  return useQuery<DeskBooking[]>({
    queryKey: ['/api/desk-bookings', dateRange?.start, dateRange?.end],
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useCreateDeskBooking() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/desk-bookings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/desk-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/desk-availability'] });
    },
  });
}

export function useGearBookings(dateRange?: { start: string; end: string }) {
  const url = dateRange ? `/api/gear-bookings?startDate=${dateRange.start}&endDate=${dateRange.end}` : '/api/gear-bookings';
  return useQuery<GearBooking[]>({
    queryKey: ['/api/gear-bookings', dateRange?.start, dateRange?.end],
    queryFn: async () => {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });
}

export function useCreateGearBooking() {
  return useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/gear-bookings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gear-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gear-availability'] });
    },
  });
}

export function useMarkGearReturned() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/gear-bookings/${id}`, { markReturned: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gear-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gear-availability'] });
    },
  });
}

export function useApproveGearBooking() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/gear-bookings/${id}`, { approved: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gear-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gear-availability'] });
    },
  });
}

export function useRejectGearBooking() {
  return useMutation({
    mutationFn: (id: number) => apiRequest('PATCH', `/api/gear-bookings/${id}`, { status: 'cancelled', approved: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gear-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gear-availability'] });
    },
  });
}

export function useDeskAvailability(date: string) {
  return useQuery<any[]>({
    queryKey: ['/api/desk-availability', date],
    enabled: !!date,
  });
}

export function useGearAvailability(date: string) {
  return useQuery<any[]>({
    queryKey: ['/api/gear-availability', date],
    enabled: !!date,
  });
}
