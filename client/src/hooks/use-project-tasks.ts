import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ProjectTask } from "@shared/schema";

export function useProjectTasks(projectId: number | undefined) {
  return useQuery<ProjectTask[]>({
    queryKey: ["/api/projects", projectId, "tasks"],
    enabled: !!projectId,
  });
}

export function useCreateProjectTask() {
  return useMutation({
    mutationFn: async ({ projectId, ...data }: { projectId: number; title: string; description?: string; status?: string; assigneeId?: number; deadline?: string; sortOrder?: number; taskGroup?: string }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/tasks`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", "all-tasks"] });
    },
  });
}

export function useUpdateProjectTask() {
  return useMutation({
    mutationFn: async ({ taskId, projectId, ...data }: { taskId: number; projectId: number; title?: string; description?: string; status?: string; assigneeId?: number | null; deadline?: string | null; sortOrder?: number; taskGroup?: string | null }) => {
      const res = await apiRequest("PATCH", `/api/projects/tasks/${taskId}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", "all-tasks"] });
    },
  });
}

export function useDeleteProjectTask() {
  return useMutation({
    mutationFn: async ({ taskId, projectId }: { taskId: number; projectId: number }) => {
      await apiRequest("DELETE", `/api/projects/tasks/${taskId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", "all-tasks"] });
    },
  });
}

export function useExtractTasks() {
  return useMutation({
    mutationFn: async (data: { text: string; projectName?: string }) => {
      const res = await apiRequest("POST", "/api/projects/extract-tasks", data);
      return res.json() as Promise<{
        suggestedName?: string;
        suggestedDescription?: string;
        tasks: Array<{ title: string; description?: string; priority: string; group?: string }>;
      }>;
    },
  });
}
