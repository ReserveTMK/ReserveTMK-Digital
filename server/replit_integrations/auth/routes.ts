import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated, isAdmin } from "./googleAuth";
import { z } from "zod";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/admin/allowed-users", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const users = await authStorage.getAllowedUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching allowed users:", error);
      res.status(500).json({ message: "Failed to fetch allowed users" });
    }
  });

  app.post("/api/admin/allowed-users", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const schema = z.object({
        email: z.string().email("Invalid email address"),
      });
      const { email } = schema.parse(req.body);
      const userId = req.user.claims.sub;
      const user = await authStorage.addAllowedUser({
        email,
        invitedBy: userId,
        status: "pending",
      });
      res.status(201).json(user);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors[0].message });
      }
      if (error?.code === "23505") {
        return res.status(409).json({ message: "This email has already been invited" });
      }
      console.error("Error adding allowed user:", error);
      res.status(500).json({ message: "Failed to add user" });
    }
  });

  app.patch("/api/admin/allowed-users/:id/revoke", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });
      const user = await authStorage.revokeAllowedUser(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      console.error("Error revoking user:", error);
      res.status(500).json({ message: "Failed to revoke user" });
    }
  });

  app.patch("/api/admin/allowed-users/:id/reactivate", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });
      const user = await authStorage.reactivateAllowedUser(id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      console.error("Error reactivating user:", error);
      res.status(500).json({ message: "Failed to reactivate user" });
    }
  });

  app.delete("/api/admin/allowed-users/:id", isAuthenticated, isAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid user ID" });
      await authStorage.deleteAllowedUser(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting allowed user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });
}
