import { db } from "./db";
import {
  contacts,
  interactions,
  type Contact,
  type InsertContact,
  type Interaction,
  type InsertInteraction,
  type UpdateContactRequest,
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// Import Auth storage to include it in the exported storage (optional pattern, or kept separate)
import { authStorage, type IAuthStorage } from "./replit_integrations/auth/storage";

export interface IStorage {
  // Contacts
  getContacts(userId: string): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, updates: UpdateContactRequest): Promise<Contact>;
  deleteContact(id: number): Promise<void>;

  // Interactions
  getInteractions(contactId: number): Promise<Interaction[]>;
  createInteraction(interaction: InsertInteraction): Promise<Interaction>;
  
  // Auth (re-exported or separate)
  auth: IAuthStorage;
}

export class DatabaseStorage implements IStorage {
  public auth = authStorage;

  // Contacts
  async getContacts(userId: string): Promise<Contact[]> {
    return await db.select()
      .from(contacts)
      .where(eq(contacts.userId, userId))
      .orderBy(desc(contacts.updatedAt));
  }

  async getContact(id: number): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async updateContact(id: number, updates: UpdateContactRequest): Promise<Contact> {
    const [contact] = await db
      .update(contacts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return contact;
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  // Interactions
  async getInteractions(contactId: number): Promise<Interaction[]> {
    return await db.select()
      .from(interactions)
      .where(eq(interactions.contactId, contactId))
      .orderBy(desc(interactions.date));
  }

  async createInteraction(insertInteraction: InsertInteraction): Promise<Interaction> {
    const [interaction] = await db.insert(interactions).values(insertInteraction).returning();
    
    // Auto-update contact metrics if analysis is present
    if (insertInteraction.analysis) {
      const analysis = insertInteraction.analysis as any;
      if (analysis.mindsetScore !== undefined || analysis.skillScore !== undefined || analysis.confidenceScore !== undefined) {
         await db.update(contacts)
           .set({
             metrics: {
               mindset: analysis.mindsetScore ?? 0,
               skill: analysis.skillScore ?? 0,
               confidence: analysis.confidenceScore ?? 0,
             },
             updatedAt: new Date(),
           })
           .where(eq(contacts.id, insertInteraction.contactId));
      }
    }

    return interaction;
  }
}

export const storage = new DatabaseStorage();
