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
  role: text("role").notNull(), // 'Business Owner', 'Innovator', 'Mentee'
  email: text("email"),
  phone: text("phone"),
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

// === RELATIONS ===
export const contactsRelations = relations(contacts, ({ many }) => ({
  interactions: many(interactions),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  contact: one(contacts, {
    fields: [interactions.contactId],
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

// === EXPLICIT API CONTRACT TYPES ===
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Interaction = typeof interactions.$inferSelect;
export type InsertInteraction = z.infer<typeof insertInteractionSchema>;

// Request types
export type CreateContactRequest = InsertContact;
export type UpdateContactRequest = Partial<InsertContact>;

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
