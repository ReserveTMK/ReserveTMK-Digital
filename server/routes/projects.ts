import type { Express } from "express";
import { isAuthenticated } from "../replit_integrations/auth";
import { storage } from "../storage";
import { claudeJSON, AIKeyMissingError } from "../replit_integrations/anthropic/client";
import { insertProjectSchema, insertProjectUpdateSchema, insertProjectTaskSchema } from "@shared/schema";
import { parseId } from "./_helpers";

export function registerProjectRoutes(app: Express) {
  app.get("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const items = await storage.getProjects(userId);
      res.json(items);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.get("/api/projects/all-tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const tasks = await storage.getAllProjectTasks(userId);
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get all tasks" });
    }
  });

  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const item = await storage.getProject(id);
      if (!item) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (item.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      res.json(item);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  app.post("/api/projects", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const body = { ...req.body };
      if (body.startDate) body.startDate = new Date(body.startDate);
      if (body.endDate) body.endDate = new Date(body.endDate);
      const validated = insertProjectSchema.parse({ ...body, createdBy: userId });
      const project = await storage.createProject(validated);
      await storage.createProjectUpdate({
        projectId: project.id,
        updateType: "note",
        updateText: "Project created",
        createdBy: userId,
      });
      res.status(201).json(project);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create project" });
    }
  });

  app.patch("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getProject(id);
      if (!existing) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (existing.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const body = { ...req.body };
      if (body.startDate) body.startDate = new Date(body.startDate);
      if (body.endDate) body.endDate = new Date(body.endDate);
      const validated = insertProjectSchema.partial().parse(body);
      const updated = await storage.updateProject(id, validated);
      if (body.status && body.status !== existing.status) {
        await storage.createProjectUpdate({
          projectId: id,
          updateType: "status_change",
          updateText: `Status changed from ${existing.status} to ${req.body.status}`,
          createdBy: userId,
        });
      }
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const existing = await storage.getProject(id);
      if (!existing) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (existing.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteProject(id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.get("/api/projects/:id/updates", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const updates = await storage.getProjectUpdates(projectId);
      res.json(updates);
    } catch (err: any) {
      res.status(500).json({ message: "Failed to fetch project updates" });
    }
  });

  app.post("/api/projects/:id/updates", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const validated = insertProjectUpdateSchema.parse({
        ...req.body,
        projectId,
        createdBy: userId,
      });
      const update = await storage.createProjectUpdate(validated);
      await storage.updateProject(projectId, {});
      res.status(201).json(update);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create project update" });
    }
  });

  app.get("/api/projects/:id/tasks", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const tasks = await storage.getProjectTasks(projectId);
      res.json(tasks);
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to get project tasks" });
    }
  });

  app.post("/api/projects/:id/tasks", isAuthenticated, async (req, res) => {
    try {
      const projectId = parseId(req.params.id);
      const project = await storage.getProject(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const body = { ...req.body, projectId };
      if (body.deadline) body.deadline = new Date(body.deadline);
      const validated = insertProjectTaskSchema.parse(body);
      const task = await storage.createProjectTask(validated);
      await storage.updateProject(projectId, {});
      res.status(201).json(task);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to create project task" });
    }
  });

  app.patch("/api/projects/tasks/:taskId", isAuthenticated, async (req, res) => {
    try {
      const taskId = parseId(req.params.taskId);
      const task = await storage.getProjectTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const project = await storage.getProject(task.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      const body = { ...req.body };
      delete body.projectId;
      if (body.deadline) body.deadline = new Date(body.deadline);
      const validated = insertProjectTaskSchema.partial().parse(body);
      const updated = await storage.updateProjectTask(taskId, validated);
      await storage.updateProject(task.projectId, {});
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || "Failed to update task" });
    }
  });

  app.delete("/api/projects/tasks/:taskId", isAuthenticated, async (req, res) => {
    try {
      const taskId = parseId(req.params.taskId);
      const task = await storage.getProjectTask(taskId);
      if (!task) return res.status(404).json({ message: "Task not found" });
      const project = await storage.getProject(task.projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      const userId = (req.user as any).claims.sub;
      if (project.createdBy !== userId) return res.status(403).json({ message: "Forbidden" });
      await storage.deleteProjectTask(taskId);
      await storage.updateProject(task.projectId, {});
      res.status(204).end();
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to delete task" });
    }
  });

  app.post("/api/projects/extract-tasks", isAuthenticated, async (req, res) => {
    try {
      const { text, projectName } = req.body;
      if (!text || typeof text !== "string" || text.trim().length < 5) {
        return res.status(400).json({ message: "Please provide some text to extract tasks from" });
      }

      const result = await claudeJSON({
        model: "claude-sonnet-4-6",
        system: `You are a project management assistant for ReserveTMK Digital, a Māori and Pasifika community development organisation in Tāmaki Makaurau (Auckland), Aotearoa New Zealand. You extract actionable tasks from voice debriefs, meeting notes, and freeform text, and organise them into logical groups.

You understand Te Reo Māori terms (whānau, rangatahi, kaitiaki, mahi, kaupapa, etc.) and NZ business context.

Extract clear, specific, actionable tasks. Each task should be something one person can do. Break down vague items into concrete steps where possible. Organise tasks into logical groups based on their nature or domain.`,
        prompt: `Analyze this text and extract all actionable tasks, organised into logical groups:

"""
${text.trim()}
"""

${projectName ? `The project is called "${projectName}".` : "Also suggest a short project name and brief description based on the content."}

Return JSON in this exact format:
{
  ${projectName ? "" : '"suggestedName": "short project name",\n  "suggestedDescription": "one sentence description",\n  '}"tasks": [
    {
      "title": "Clear actionable task title",
      "description": "Brief context or details (optional, can be null)",
      "priority": "high" | "medium" | "low",
      "group": "Group Name"
    }
  ]
}

Rules:
- Extract every actionable item, no matter how small
- Task titles should be clear and start with a verb (e.g. "Set up...", "Contact...", "Review...")
- Priority: high = urgent/deadline-driven, medium = important but flexible, low = nice to have
- If the text mentions deadlines, include them in the task description
- If the text mentions people by name, include them in the task description
- Return at least 1 task, even if the text is vague
- Every task MUST have a "group" — a short, clear category name (e.g. "Design", "Development", "Admin", "Outreach", "Follow-ups", "Planning", "Communications")
- Aim for 2-5 groups depending on the scope of work. Keep group names concise (1-2 words)
- Tasks that are related should share the same group name
- Order tasks within each group by priority (high first)`,
        temperature: 0.2,
        maxTokens: 4096,
      });

      res.json(result);
    } catch (err: any) {
      if (err instanceof AIKeyMissingError) return res.status(503).json({ message: err.message });
      console.error("Task extraction error:", err);
      res.status(500).json({ message: err.message || "Failed to extract tasks" });
    }
  });
}
