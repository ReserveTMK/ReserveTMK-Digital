import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function useEventAttendance(eventId: number | undefined) {
  return useQuery({
    queryKey: ['/api/event-attendance', eventId],
    queryFn: () => fetch(`/api/event-attendance/${eventId}`, { credentials: 'include' }).then(r => r.json()),
    enabled: !!eventId,
  });
}

export function useAddAttendance() {
  return useMutation({
    mutationFn: ({ eventId, contactId, role }: { eventId: number; contactId: number; role: string }) =>
      apiRequest('POST', '/api/event-attendance', { eventId, contactId, role }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-attendance', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
  });
}

export function useRemoveAttendance(eventId?: number) {
  return useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/event-attendance/${id}`),
    onSuccess: () => {
      if (eventId) {
        queryClient.invalidateQueries({ queryKey: ['/api/event-attendance', eventId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['/api/event-attendance'] });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
  });
}
