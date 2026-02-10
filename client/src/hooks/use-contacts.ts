import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateContactRequest, type UpdateContactRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

// GET /api/contacts
export function useContacts() {
  return useQuery({
    queryKey: [api.contacts.list.path],
    queryFn: async () => {
      const res = await fetch(api.contacts.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch contacts");
      return api.contacts.list.responses[200].parse(await res.json());
    },
  });
}

// GET /api/contacts/:id
export function useContact(id: number) {
  return useQuery({
    queryKey: [api.contacts.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.contacts.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch contact");
      return api.contacts.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

// POST /api/contacts
export function useCreateContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: CreateContactRequest) => {
      const res = await fetch(api.contacts.create.path, {
        method: api.contacts.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create contact");
      }
      return api.contacts.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.contacts.list.path] });
      toast({ title: "Success", description: "Contact created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// PATCH /api/contacts/:id
export function useUpdateContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateContactRequest) => {
      const url = buildUrl(api.contacts.update.path, { id });
      const res = await fetch(url, {
        method: api.contacts.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update contact");
      }
      return api.contacts.update.responses[200].parse(await res.json());
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [api.contacts.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.contacts.get.path, data.id] });
      toast({ title: "Success", description: "Contact updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// DELETE /api/contacts/:id
export function useDeleteContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.contacts.delete.path, { id });
      const res = await fetch(url, { method: api.contacts.delete.method, credentials: "include" });
      if (!res.ok) throw new Error("Failed to delete contact");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.contacts.list.path] });
      toast({ title: "Success", description: "Contact deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
