import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useGroups() {
  return useQuery({
    queryKey: [api.groups.list.path],
    queryFn: async () => {
      const res = await fetch(api.groups.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch groups");
      return res.json();
    },
  });
}

export function useGroup(id: number) {
  return useQuery({
    queryKey: [api.groups.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.groups.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch group");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useGroupMembers(groupId: number) {
  return useQuery({
    queryKey: [api.groups.members.list.path, groupId],
    queryFn: async () => {
      const url = buildUrl(api.groups.members.list.path, { id: groupId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch group members");
      return res.json();
    },
    enabled: !!groupId,
  });
}

export function useContactGroups(contactId: number) {
  return useQuery({
    queryKey: ["/api/contacts/:id/groups", contactId],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${contactId}/groups`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch contact groups");
      return res.json();
    },
    enabled: !!contactId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await fetch(api.groups.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create group");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.groups.list.path] });
      toast({ title: "Success", description: "Group created" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      const url = buildUrl(api.groups.update.path, { id });
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update group");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.groups.list.path] });
      toast({ title: "Success", description: "Group updated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.groups.delete.path, { id });
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete group");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.groups.list.path] });
      toast({ title: "Success", description: "Group deleted" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useAddGroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, contactId, role }: { groupId: number; contactId: number; role?: string }) => {
      const url = buildUrl(api.groups.members.add.path, { id: groupId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId, contactId, role: role || "member" }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add member");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.groups.members.list.path, variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/:id/groups", variables.contactId] });
    },
  });
}

export function useEnrichGroup() {
  return useMutation({
    mutationFn: async (groupId: number) => {
      const res = await fetch(`/api/groups/${groupId}/enrich`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to enrich group");
      }
      return res.json();
    },
  });
}

export function useGroupTaxonomyLinks(groupId: number) {
  return useQuery({
    queryKey: ["/api/groups/:id/taxonomy-links", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/taxonomy-links`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch taxonomy links");
      return res.json();
    },
    enabled: !!groupId,
  });
}

export function useSaveGroupTaxonomyLinks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, links }: { groupId: number; links: { taxonomyId: number; confidence: number | null; reasoning: string | null }[] }) => {
      const res = await fetch(`/api/groups/${groupId}/taxonomy-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to save taxonomy links");
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups/:id/taxonomy-links", variables.groupId] });
    },
  });
}

export function useGroupAssociations(groupId: number) {
  return useQuery({
    queryKey: ["/api/groups/:id/associations", groupId],
    queryFn: async () => {
      const res = await fetch(`/api/groups/${groupId}/associations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch associations");
      return res.json();
    },
    enabled: !!groupId,
  });
}

export function useAllGroupAssociations() {
  return useQuery({
    queryKey: ["/api/groups/all-associations"],
    queryFn: async () => {
      const res = await fetch("/api/groups/all-associations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch all associations");
      return res.json();
    },
  });
}

export function useAddGroupAssociation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, associatedGroupId, relationshipType = "peer" }: { groupId: number; associatedGroupId: number; relationshipType?: string }) => {
      const res = await fetch(`/api/groups/${groupId}/associations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ associatedGroupId, relationshipType }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to add association");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups/:id/associations", variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/:id/associations", variables.associatedGroupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/all-associations"] });
    },
  });
}

export function useUpdateGroupAssociation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, associationId, relationshipType }: { groupId: number; associationId: number; relationshipType: string }) => {
      const res = await fetch(`/api/groups/${groupId}/associations/${associationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipType }),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update association");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups/:id/associations", variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/all-associations"] });
    },
  });
}

export function useRemoveGroupAssociation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, associationId }: { groupId: number; associationId: number }) => {
      const res = await fetch(`/api/groups/${groupId}/associations/${associationId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove association");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups/:id/associations", variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/groups/all-associations"] });
    },
  });
}

export function useRemoveGroupMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ groupId, memberId, contactId }: { groupId: number; memberId: number; contactId: number }) => {
      const url = `/api/groups/${groupId}/members/${memberId}`;
      const res = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to remove member");
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.groups.members.list.path, variables.groupId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts/:id/groups", variables.contactId] });
    },
  });
}
