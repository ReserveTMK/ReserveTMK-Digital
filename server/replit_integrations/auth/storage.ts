import { users, allowedUsers, type User, type UpsertUser, type AllowedUser, type InsertAllowedUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";

const ADMIN_USER_ID = "54568936";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.toLowerCase().trim() || "";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  isEmailAllowed(email: string): Promise<boolean>;
  activateAllowedUser(email: string): Promise<void>;
  getAllowedUsers(): Promise<AllowedUser[]>;
  addAllowedUser(data: InsertAllowedUser): Promise<AllowedUser>;
  revokeAllowedUser(id: number): Promise<AllowedUser | undefined>;
  reactivateAllowedUser(id: number): Promise<AllowedUser | undefined>;
  deleteAllowedUser(id: number): Promise<void>;
  ensureAdminSeeded(): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const isAdminUser = userData.id === ADMIN_USER_ID ||
      (ADMIN_EMAIL && userData.email?.toLowerCase().trim() === ADMIN_EMAIL);
    try {
      const [user] = await db
        .insert(users)
        .values({ ...userData, isAdmin: isAdminUser || undefined })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            ...userData,
            ...(isAdminUser ? { isAdmin: true } : {}),
            updatedAt: new Date(),
          },
        })
        .returning();

      if (isAdminUser && userData.email) {
        await this.ensureAllowedUser(userData.email, ADMIN_USER_ID);
      }

      return user;
    } catch (err: any) {
      if (err?.code === "23505" && err?.constraint?.includes("email")) {
        const [existing] = await db.select().from(users).where(eq(users.email, userData.email!));
        if (existing) {
          const [updated] = await db
            .update(users)
            .set({ ...userData, ...(isAdminUser ? { isAdmin: true } : {}), updatedAt: new Date() })
            .where(eq(users.id, existing.id))
            .returning();
          return updated;
        }
      }
      throw err;
    }
  }

  private async ensureAllowedUser(email: string, invitedBy: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    const [existing] = await db.select().from(allowedUsers).where(eq(allowedUsers.email, normalized));
    if (!existing) {
      await db.insert(allowedUsers).values({
        email: normalized,
        invitedBy,
        status: "active",
      }).onConflictDoNothing();
    } else if (existing.status !== "active") {
      await db.update(allowedUsers).set({ status: "active", updatedAt: new Date() }).where(eq(allowedUsers.id, existing.id));
    }
  }

  async isEmailAllowed(email: string): Promise<boolean> {
    const normalized = email.toLowerCase().trim();
    const [row] = await db
      .select()
      .from(allowedUsers)
      .where(eq(allowedUsers.email, normalized));
    if (!row) return false;
    return row.status === "pending" || row.status === "active";
  }

  async activateAllowedUser(email: string): Promise<void> {
    const normalized = email.toLowerCase().trim();
    await db
      .update(allowedUsers)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(allowedUsers.email, normalized));
  }

  async getAllowedUsers(): Promise<AllowedUser[]> {
    return db.select().from(allowedUsers);
  }

  async addAllowedUser(data: InsertAllowedUser): Promise<AllowedUser> {
    const normalized = { ...data, email: data.email.toLowerCase().trim() };
    const [row] = await db.insert(allowedUsers).values(normalized).returning();
    return row;
  }

  async revokeAllowedUser(id: number): Promise<AllowedUser | undefined> {
    const [row] = await db
      .update(allowedUsers)
      .set({ status: "revoked", updatedAt: new Date() })
      .where(eq(allowedUsers.id, id))
      .returning();
    return row;
  }

  async reactivateAllowedUser(id: number): Promise<AllowedUser | undefined> {
    const [row] = await db
      .update(allowedUsers)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(allowedUsers.id, id))
      .returning();
    return row;
  }

  async deleteAllowedUser(id: number): Promise<void> {
    await db.delete(allowedUsers).where(eq(allowedUsers.id, id));
  }

  async ensureAdminSeeded(): Promise<void> {
    const adminUser = await this.getUser(ADMIN_USER_ID);
    if (adminUser) {
      if (!adminUser.isAdmin) {
        await db.update(users).set({ isAdmin: true }).where(eq(users.id, ADMIN_USER_ID));
      }
      if (adminUser.email) {
        const normalizedEmail = adminUser.email.toLowerCase().trim();
        const [existing] = await db.select().from(allowedUsers).where(eq(allowedUsers.email, normalizedEmail));
        if (!existing) {
          await db.insert(allowedUsers).values({
            email: normalizedEmail,
            invitedBy: ADMIN_USER_ID,
            status: "active",
          }).onConflictDoNothing();
        }
      }
    }
  }
}

export const authStorage = new AuthStorage();
