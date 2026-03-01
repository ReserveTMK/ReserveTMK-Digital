import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Project, ProjectUpdate } from "@shared/schema";

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
}

export function useProject(id: number | undefined) {
  return useQuery<Project>({
    queryKey: ["/api/projects", id],
    enabled: !!id,
  });
}

export function useProjectUpdates(projectId: number | undefined) {
  return useQuery<ProjectUpdate[]>({
    queryKey: ["/api/projects", projectId, "updates"],
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  return useMutation({
    mutationFn: async (data: Partial<Project>) => {
      const res = await apiRequest("POST", "/api/projects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

export function useUpdateProject() {
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Project> & { id: number }) => {
      const res = await apiRequest("PATCH", `/api/projects/${id}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.id, "updates"] });
    },
  });
}

export function useDeleteProject() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}

export function useCreateProjectUpdate() {
  return useMutation({
    mutationFn: async ({ projectId, ...data }: { projectId: number; updateType: string; updateText: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/updates`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId, "updates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
  });
}
