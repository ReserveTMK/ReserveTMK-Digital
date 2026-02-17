import { db } from "./db";
import {
  contacts,
  interactions,
  meetings,
  events,
  eventAttendance,
  impactLogs,
  impactLogContacts,
  impactTaxonomy,
  impactTags,
  keywordDictionary,
  actionItems,
  consentRecords,
  auditLog,
  dismissedCalendarEvents,
  calendarSettings,
  type Contact,
  type InsertContact,
  type Interaction,
  type InsertInteraction,
  type UpdateContactRequest,
  type Meeting,
  type InsertMeeting,
  type UpdateMeetingRequest,
  type Event,
  type InsertEvent,
  type UpdateEventRequest,
  type EventAttendance,
  type InsertEventAttendance,
  type ImpactLog,
  type InsertImpactLog,
  type ImpactLogContact,
  type InsertImpactLogContact,
  type ImpactTaxonomy,
  type InsertImpactTaxonomy,
  type ImpactTag,
  type InsertImpactTag,
  type KeywordDictionary,
  type InsertKeywordDictionary,
  type ActionItem,
  type InsertActionItem,
  type ConsentRecord,
  type InsertConsentRecord,
  type AuditLog as AuditLogType,
  type InsertAuditLog,
  type DismissedCalendarEvent,
  type InsertDismissedCalendarEvent,
  type CalendarSetting,
  type InsertCalendarSetting,
  programmes,
  programmeEvents,
  type Programme,
  type InsertProgramme,
  type ProgrammeEvent,
  type InsertProgrammeEvent,
} from "@shared/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

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
  
  // Events
  getEvents(userId: string): Promise<Event[]>;
  getEvent(id: number): Promise<Event | undefined>;
  getEventByGoogleCalendarId(googleCalendarEventId: string, userId: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, updates: any): Promise<Event>;
  deleteEvent(id: number): Promise<void>;

  // Event Attendance
  getEventAttendance(eventId: number): Promise<EventAttendance[]>;
  getContactAttendance(contactId: number): Promise<EventAttendance[]>;
  addEventAttendance(data: InsertEventAttendance): Promise<EventAttendance>;
  removeEventAttendance(id: number): Promise<void>;

  // Impact Logs
  getImpactLogs(userId: string): Promise<ImpactLog[]>;
  getImpactLog(id: number): Promise<ImpactLog | undefined>;
  createImpactLog(data: InsertImpactLog): Promise<ImpactLog>;
  updateImpactLog(id: number, updates: Partial<InsertImpactLog>): Promise<ImpactLog>;
  deleteImpactLog(id: number): Promise<void>;

  // Impact Log Contacts
  getImpactLogContacts(impactLogId: number): Promise<ImpactLogContact[]>;
  getContactImpactLogs(contactId: number): Promise<ImpactLogContact[]>;
  addImpactLogContact(data: InsertImpactLogContact): Promise<ImpactLogContact>;
  removeImpactLogContact(id: number): Promise<void>;

  // Impact Taxonomy
  getTaxonomy(userId: string): Promise<ImpactTaxonomy[]>;
  createTaxonomyItem(data: InsertImpactTaxonomy): Promise<ImpactTaxonomy>;
  updateTaxonomyItem(id: number, updates: Partial<InsertImpactTaxonomy>): Promise<ImpactTaxonomy>;
  deleteTaxonomyItem(id: number): Promise<void>;

  // Impact Tags
  getImpactTags(impactLogId: number): Promise<ImpactTag[]>;
  addImpactTag(data: InsertImpactTag): Promise<ImpactTag>;
  removeImpactTag(id: number): Promise<void>;

  // Keyword Dictionary
  getKeywords(userId: string): Promise<KeywordDictionary[]>;
  createKeyword(data: InsertKeywordDictionary): Promise<KeywordDictionary>;
  deleteKeyword(id: number): Promise<void>;

  // Action Items
  getActionItems(userId: string): Promise<ActionItem[]>;
  getContactActionItems(contactId: number): Promise<ActionItem[]>;
  createActionItem(data: InsertActionItem): Promise<ActionItem>;
  updateActionItem(id: number, updates: Partial<InsertActionItem>): Promise<ActionItem>;
  deleteActionItem(id: number): Promise<void>;

  // Consent Records
  getConsentRecords(contactId: number): Promise<ConsentRecord[]>;
  createConsentRecord(data: InsertConsentRecord): Promise<ConsentRecord>;

  // Audit Log
  getAuditLogs(entityType: string, entityId: number): Promise<AuditLogType[]>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLogType>;

  // Dismissed Calendar Events
  getDismissedCalendarEvents(userId: string): Promise<DismissedCalendarEvent[]>;
  dismissCalendarEvent(data: InsertDismissedCalendarEvent): Promise<DismissedCalendarEvent>;
  restoreCalendarEvent(id: number): Promise<void>;

  // Calendar Settings
  getCalendarSettings(userId: string): Promise<CalendarSetting[]>;
  addCalendarSetting(data: InsertCalendarSetting): Promise<CalendarSetting>;
  updateCalendarSetting(id: number, updates: Partial<InsertCalendarSetting>): Promise<CalendarSetting>;
  deleteCalendarSetting(id: number): Promise<void>;

  // Programmes
  getProgrammes(userId: string): Promise<Programme[]>;
  getProgramme(id: number): Promise<Programme | undefined>;
  createProgramme(data: InsertProgramme): Promise<Programme>;
  updateProgramme(id: number, updates: Partial<InsertProgramme>): Promise<Programme>;
  deleteProgramme(id: number): Promise<void>;

  // Programme Events
  getProgrammeEvents(programmeId: number): Promise<ProgrammeEvent[]>;
  addProgrammeEvent(data: InsertProgrammeEvent): Promise<ProgrammeEvent>;
  removeProgrammeEvent(id: number): Promise<void>;

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

  // Events
  async getEvents(userId: string): Promise<Event[]> {
    return await db.select()
      .from(events)
      .where(eq(events.userId, userId))
      .orderBy(desc(events.startTime));
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEventByGoogleCalendarId(googleCalendarEventId: string, userId: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events)
      .where(and(eq(events.googleCalendarEventId, googleCalendarEventId), eq(events.userId, userId)));
    return event;
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [event] = await db.insert(events).values(insertEvent).returning();
    return event;
  }

  async updateEvent(id: number, updates: UpdateEventRequest): Promise<Event> {
    const [event] = await db
      .update(events)
      .set(updates)
      .where(eq(events.id, id))
      .returning();
    return event;
  }

  async deleteEvent(id: number): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  // Event Attendance
  async getEventAttendance(eventId: number): Promise<EventAttendance[]> {
    return await db.select()
      .from(eventAttendance)
      .where(eq(eventAttendance.eventId, eventId))
      .orderBy(desc(eventAttendance.createdAt));
  }

  async getContactAttendance(contactId: number): Promise<EventAttendance[]> {
    return await db.select()
      .from(eventAttendance)
      .where(eq(eventAttendance.contactId, contactId))
      .orderBy(desc(eventAttendance.createdAt));
  }

  async addEventAttendance(data: InsertEventAttendance): Promise<EventAttendance> {
    const [record] = await db.insert(eventAttendance).values(data).returning();
    return record;
  }

  async removeEventAttendance(id: number): Promise<void> {
    await db.delete(eventAttendance).where(eq(eventAttendance.id, id));
  }

  // Impact Logs
  async getImpactLogs(userId: string): Promise<ImpactLog[]> {
    return await db.select()
      .from(impactLogs)
      .where(eq(impactLogs.userId, userId))
      .orderBy(desc(impactLogs.createdAt));
  }

  async getImpactLog(id: number): Promise<ImpactLog | undefined> {
    const [log] = await db.select().from(impactLogs).where(eq(impactLogs.id, id));
    return log;
  }

  async createImpactLog(data: InsertImpactLog): Promise<ImpactLog> {
    const [log] = await db.insert(impactLogs).values(data).returning();
    return log;
  }

  async updateImpactLog(id: number, updates: Partial<InsertImpactLog>): Promise<ImpactLog> {
    const [log] = await db
      .update(impactLogs)
      .set(updates)
      .where(eq(impactLogs.id, id))
      .returning();
    return log;
  }

  async deleteImpactLog(id: number): Promise<void> {
    await db.delete(impactLogs).where(eq(impactLogs.id, id));
  }

  // Impact Log Contacts
  async getImpactLogContacts(impactLogId: number): Promise<ImpactLogContact[]> {
    return await db.select()
      .from(impactLogContacts)
      .where(eq(impactLogContacts.impactLogId, impactLogId))
      .orderBy(desc(impactLogContacts.createdAt));
  }

  async getContactImpactLogs(contactId: number): Promise<ImpactLogContact[]> {
    return await db.select()
      .from(impactLogContacts)
      .where(eq(impactLogContacts.contactId, contactId))
      .orderBy(desc(impactLogContacts.createdAt));
  }

  async addImpactLogContact(data: InsertImpactLogContact): Promise<ImpactLogContact> {
    const [record] = await db.insert(impactLogContacts).values(data).returning();
    return record;
  }

  async removeImpactLogContact(id: number): Promise<void> {
    await db.delete(impactLogContacts).where(eq(impactLogContacts.id, id));
  }

  // Impact Taxonomy
  private seedingUsers = new Set<string>();

  async getTaxonomy(userId: string): Promise<ImpactTaxonomy[]> {
    const existing = await db.select()
      .from(impactTaxonomy)
      .where(eq(impactTaxonomy.userId, userId))
      .orderBy(impactTaxonomy.sortOrder);
    if (existing.length === 0 && !this.seedingUsers.has(userId)) {
      this.seedingUsers.add(userId);
      try {
        await this.seedDefaultTaxonomy(userId);
      } finally {
        this.seedingUsers.delete(userId);
      }
      return await db.select()
        .from(impactTaxonomy)
        .where(eq(impactTaxonomy.userId, userId))
        .orderBy(impactTaxonomy.sortOrder);
    }
    return existing;
  }

  private static readonly DEFAULT_TAXONOMY = [
    { name: 'Hub Engagement', description: 'Track facility usage and programme participation metrics. Physical participation and attendance at Reserve activities.', color: 'blue', sortOrder: 1 },
    { name: 'Business Progress', description: 'Capture commercial development and revenue outcomes. Tangible business milestones and financial sustainability markers.', color: 'green', sortOrder: 2 },
    { name: 'Skills & Capability Growth', description: 'Measure competency development and confidence building. Knowledge acquisition, self-efficacy changes, decision-making improvement.', color: 'purple', sortOrder: 3 },
    { name: 'Network & Ecosystem Connection', description: 'Document relationship formation and ecosystem integration. Introductions, partnerships, mentorship, peer connections established.', color: 'orange', sortOrder: 4 },
    { name: 'Rangatahi Development', description: 'Track youth-specific engagement and outcomes. Participants under 25, youth entrepreneurship development, early-stage ventures.', color: 'pink', sortOrder: 5 },
  ];

  private static readonly SEMANTIC_INDICATORS: Record<string, string[]> = {
    'Hub Engagement': ['registered as member', 'attended workshop', 'came to event', 'used coworking space', 'participated in programme', 'joined session', 'turned up to', 'booked in for', 'regular user'],
    'Business Progress': ['made first sale', 'got customer', 'launched business', 'registered company', 'earned revenue', 'hired someone', 'secured contract', 'still trading', 'business growing', 'sustainable income', 'wholesale client', 'repeat customer'],
    'Skills & Capability Growth': ['learned how to', 'now understand', 'figured out how', 'gained confidence', 'feel capable', 'can now do', 'developed skill in', 'understand pricing', 'know how to market', 'improved at', 'making better decisions', 'ready to take next step'],
    'Network & Ecosystem Connection': ['met someone who', 'introduced to', 'connected with', 'found mentor', 'got referral to', 'partnered with', 'collaborated with', 'supported by', 'linked to', 'now working with', 'relationships with'],
    'Rangatahi Development': ['young entrepreneur', 'rangatahi participated', 'youth attended', 'first business idea', 'school leaver', 'starting out', 'early career', 'young person', 'student entrepreneur', 'developing mindset'],
  };

  private async seedDefaultTaxonomy(userId: string): Promise<void> {
    const inserted = await db.insert(impactTaxonomy).values(
      DatabaseStorage.DEFAULT_TAXONOMY.map(d => ({ userId, ...d, active: true }))
    ).onConflictDoNothing().returning();

    if (inserted.length === 0) return;

    const keywordRows: { userId: string; phrase: string; taxonomyId: number }[] = [];
    for (const cat of inserted) {
      const phrases = DatabaseStorage.SEMANTIC_INDICATORS[cat.name];
      if (phrases) {
        for (const phrase of phrases) {
          keywordRows.push({ userId, phrase, taxonomyId: cat.id });
        }
      }
    }
    if (keywordRows.length > 0) {
      await db.insert(keywordDictionary).values(keywordRows).onConflictDoNothing();
    }
  }

  async createTaxonomyItem(data: InsertImpactTaxonomy): Promise<ImpactTaxonomy> {
    const [item] = await db.insert(impactTaxonomy).values(data).returning();
    return item;
  }

  async updateTaxonomyItem(id: number, updates: Partial<InsertImpactTaxonomy>): Promise<ImpactTaxonomy> {
    const [item] = await db
      .update(impactTaxonomy)
      .set(updates)
      .where(eq(impactTaxonomy.id, id))
      .returning();
    return item;
  }

  async deleteTaxonomyItem(id: number): Promise<void> {
    await db.delete(impactTaxonomy).where(eq(impactTaxonomy.id, id));
  }

  // Impact Tags
  async getImpactTags(impactLogId: number): Promise<ImpactTag[]> {
    return await db.select()
      .from(impactTags)
      .where(eq(impactTags.impactLogId, impactLogId))
      .orderBy(desc(impactTags.createdAt));
  }

  async addImpactTag(data: InsertImpactTag): Promise<ImpactTag> {
    const [tag] = await db.insert(impactTags).values(data).returning();
    return tag;
  }

  async removeImpactTag(id: number): Promise<void> {
    await db.delete(impactTags).where(eq(impactTags.id, id));
  }

  // Keyword Dictionary
  async getKeywords(userId: string): Promise<KeywordDictionary[]> {
    return await db.select()
      .from(keywordDictionary)
      .where(eq(keywordDictionary.userId, userId))
      .orderBy(desc(keywordDictionary.createdAt));
  }

  async createKeyword(data: InsertKeywordDictionary): Promise<KeywordDictionary> {
    const [keyword] = await db.insert(keywordDictionary).values(data).returning();
    return keyword;
  }

  async deleteKeyword(id: number): Promise<void> {
    await db.delete(keywordDictionary).where(eq(keywordDictionary.id, id));
  }

  // Action Items
  async getActionItems(userId: string): Promise<ActionItem[]> {
    return await db.select()
      .from(actionItems)
      .where(eq(actionItems.userId, userId))
      .orderBy(desc(actionItems.createdAt));
  }

  async getContactActionItems(contactId: number): Promise<ActionItem[]> {
    return await db.select()
      .from(actionItems)
      .where(eq(actionItems.contactId, contactId))
      .orderBy(desc(actionItems.createdAt));
  }

  async createActionItem(data: InsertActionItem): Promise<ActionItem> {
    const [item] = await db.insert(actionItems).values(data).returning();
    return item;
  }

  async updateActionItem(id: number, updates: Partial<InsertActionItem>): Promise<ActionItem> {
    const [item] = await db
      .update(actionItems)
      .set(updates)
      .where(eq(actionItems.id, id))
      .returning();
    return item;
  }

  async deleteActionItem(id: number): Promise<void> {
    await db.delete(actionItems).where(eq(actionItems.id, id));
  }

  // Consent Records
  async getConsentRecords(contactId: number): Promise<ConsentRecord[]> {
    return await db.select()
      .from(consentRecords)
      .where(eq(consentRecords.contactId, contactId))
      .orderBy(desc(consentRecords.createdAt));
  }

  async createConsentRecord(data: InsertConsentRecord): Promise<ConsentRecord> {
    const [record] = await db.insert(consentRecords).values(data).returning();
    return record;
  }

  // Audit Log
  async getAuditLogs(entityType: string, entityId: number): Promise<AuditLogType[]> {
    return await db.select()
      .from(auditLog)
      .where(and(eq(auditLog.entityType, entityType), eq(auditLog.entityId, entityId)))
      .orderBy(desc(auditLog.createdAt));
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLogType> {
    const [record] = await db.insert(auditLog).values(data).returning();
    return record;
  }

  // Dismissed Calendar Events
  async getDismissedCalendarEvents(userId: string): Promise<DismissedCalendarEvent[]> {
    return await db.select()
      .from(dismissedCalendarEvents)
      .where(eq(dismissedCalendarEvents.userId, userId))
      .orderBy(desc(dismissedCalendarEvents.createdAt));
  }

  async dismissCalendarEvent(data: InsertDismissedCalendarEvent): Promise<DismissedCalendarEvent> {
    const [existing] = await db.select()
      .from(dismissedCalendarEvents)
      .where(
        and(
          eq(dismissedCalendarEvents.userId, data.userId),
          eq(dismissedCalendarEvents.gcalEventId, data.gcalEventId),
          eq(dismissedCalendarEvents.reason, data.reason),
        )
      );
    if (existing) return existing;
    const [record] = await db.insert(dismissedCalendarEvents).values(data).returning();
    return record;
  }

  async restoreCalendarEvent(id: number): Promise<void> {
    await db.delete(dismissedCalendarEvents).where(eq(dismissedCalendarEvents.id, id));
  }

  // Calendar Settings
  async getCalendarSettings(userId: string): Promise<CalendarSetting[]> {
    return await db.select()
      .from(calendarSettings)
      .where(eq(calendarSettings.userId, userId))
      .orderBy(desc(calendarSettings.createdAt));
  }

  async addCalendarSetting(data: InsertCalendarSetting): Promise<CalendarSetting> {
    const [record] = await db.insert(calendarSettings).values(data).returning();
    return record;
  }

  async updateCalendarSetting(id: number, updates: Partial<InsertCalendarSetting>): Promise<CalendarSetting> {
    const [record] = await db.update(calendarSettings).set(updates).where(eq(calendarSettings.id, id)).returning();
    return record;
  }

  async deleteCalendarSetting(id: number): Promise<void> {
    await db.delete(calendarSettings).where(eq(calendarSettings.id, id));
  }

  // Programmes
  async getProgrammes(userId: string): Promise<Programme[]> {
    return await db.select()
      .from(programmes)
      .where(eq(programmes.userId, userId))
      .orderBy(desc(programmes.createdAt));
  }

  async getProgramme(id: number): Promise<Programme | undefined> {
    const [programme] = await db.select().from(programmes).where(eq(programmes.id, id));
    return programme;
  }

  async createProgramme(data: InsertProgramme): Promise<Programme> {
    const [programme] = await db.insert(programmes).values(data).returning();
    return programme;
  }

  async updateProgramme(id: number, updates: Partial<InsertProgramme>): Promise<Programme> {
    const [programme] = await db
      .update(programmes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(programmes.id, id))
      .returning();
    return programme;
  }

  async deleteProgramme(id: number): Promise<void> {
    await db.delete(programmeEvents).where(eq(programmeEvents.programmeId, id));
    await db.delete(programmes).where(eq(programmes.id, id));
  }

  // Programme Events
  async getProgrammeEvents(programmeId: number): Promise<ProgrammeEvent[]> {
    return await db.select()
      .from(programmeEvents)
      .where(eq(programmeEvents.programmeId, programmeId))
      .orderBy(desc(programmeEvents.createdAt));
  }

  async addProgrammeEvent(data: InsertProgrammeEvent): Promise<ProgrammeEvent> {
    const [record] = await db.insert(programmeEvents).values(data).returning();
    return record;
  }

  async removeProgrammeEvent(id: number): Promise<void> {
    await db.delete(programmeEvents).where(eq(programmeEvents.id, id));
  }
}

export const storage = new DatabaseStorage();
