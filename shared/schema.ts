import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Import auth tables to export them (REQUIRED for Replit Auth)
export * from "./models/auth";
export * from "./models/chat";

// === TABLE DEFINITIONS ===

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Links to users.id from auth
  name: text("name").notNull(),
  businessName: text("business_name"),
  role: text("role").notNull(), // 'Business Owner', 'Innovator', 'Mentee'
  email: text("email"),
  phone: text("phone"),
  age: integer("age"),
  ethnicity: text("ethnicity").array(),
  location: text("location"),
  tags: text("tags").array(),
  // Current baseline metrics
  metrics: jsonb("metrics").$type<{
    mindset?: number;
    skill?: number;
    confidence?: number;
  }>().default({}), 
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const interactions = pgTable("interactions", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  type: text("type").notNull(), // 'Call', 'Meeting', 'Email', 'Voice Note'
  transcript: text("transcript"),
  summary: text("summary"),
  // Analysis from AI
  analysis: jsonb("analysis").$type<{
    mindsetScore?: number;
    skillScore?: number;
    confidenceScore?: number;
    keyInsights?: string[];
  }>().default({}),
  keywords: text("keywords").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const meetings = pgTable("meetings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("scheduled"),
  location: text("location"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'Networking Event', 'Workshop', 'Activation', 'Conference', 'Community Event', 'Other'
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  attendeeCount: integer("attendee_count"),
  description: text("description"),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const contactsRelations = relations(contacts, ({ many }) => ({
  interactions: many(interactions),
  meetings: many(meetings),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  contact: one(contacts, {
    fields: [interactions.contactId],
    references: [contacts.id],
  }),
}));

export const meetingsRelations = relations(meetings, ({ one }) => ({
  contact: one(contacts, {
    fields: [meetings.contactId],
    references: [contacts.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertContactSchema = createInsertSchema(contacts).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertInteractionSchema = createInsertSchema(interactions).omit({ 
  id: true, 
  createdAt: true 
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

// === EXPLICIT API CONTRACT TYPES ===
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;

export const insertMeetingSchema = createInsertSchema(meetings).omit({
  id: true,
  createdAt: true,
});

export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// Request types
export type CreateContactRequest = InsertContact;
export type UpdateContactRequest = Partial<InsertContact>;
export type CreateMeetingRequest = InsertMeeting;
export type UpdateMeetingRequest = Partial<InsertMeeting>;

export type CreateEventRequest = InsertEvent;
export type UpdateEventRequest = Partial<InsertEvent>;

export type CreateInteractionRequest = InsertInteraction;
export type AnalyzeInteractionRequest = {
  text: string;
};

export type AnalyzeInteractionResponse = {
  summary: string;
  keywords: string[];
  metrics: {
    mindset: number;
    skill: number;
    confidence: number;
  };
};

export type ContactResponse = Contact & {
  interactions?: Interaction[];
};
