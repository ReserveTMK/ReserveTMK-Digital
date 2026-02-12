import { db } from "./db";
import {
  contacts,
  interactions,
  meetings,
  type Contact,
  type InsertContact,
  type Interaction,
  type InsertInteraction,
  type UpdateContactRequest,
  type Meeting,
  type InsertMeeting,
  type UpdateMeetingRequest,
} from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

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

  // Meetings
  getMeetings(userId: string): Promise<Meeting[]>;
  getMeeting(id: number): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: number, updates: UpdateMeetingRequest): Promise<Meeting>;
  deleteMeeting(id: number): Promise<void>;
  
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

  // Meetings
  async getMeetings(userId: string): Promise<Meeting[]> {
    return await db.select()
      .from(meetings)
      .where(eq(meetings.userId, userId))
      .orderBy(desc(meetings.startTime));
  }

  async getMeeting(id: number): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id));
    return meeting;
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(insertMeeting).returning();
    return meeting;
  }

  async updateMeeting(id: number, updates: UpdateMeetingRequest): Promise<Meeting> {
    const [meeting] = await db
      .update(meetings)
      .set(updates)
      .where(eq(meetings.id, id))
      .returning();
    return meeting;
  }

  async deleteMeeting(id: number): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }
}

export const storage = new DatabaseStorage();
