import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
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
  role: text("role").notNull(), // 'Entrepreneur', 'Professional', 'Innovator', 'Want-trepreneur', 'Rangatahi', 'Business Owner'
  email: text("email"),
  phone: text("phone"),
  age: integer("age"),
  ethnicity: text("ethnicity").array(),
  location: text("location"),
  tags: text("tags").array(),
  revenueBand: text("revenue_band"),
  metrics: jsonb("metrics").$type<{
    mindset?: number;
    skill?: number;
    confidence?: number;
    confidenceScore?: number;
    systemsInPlace?: number;
    fundingReadiness?: number;
    networkStrength?: number;
  }>().default({}), 
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  consentStatus: text("consent_status").default("pending"),
  consentDate: timestamp("consent_date"),
  consentNotes: text("consent_notes"),
  stage: text("stage"),
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
    confidenceScoreMetric?: number;
    systemsInPlaceScore?: number;
    fundingReadinessScore?: number;
    networkStrengthScore?: number;
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
  type: text("type").notNull(), // 'Meeting', 'Mentoring Session', 'External Event', 'Personal Development'
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  attendeeCount: integer("attendee_count"),
  description: text("description"),
  tags: text("tags").array(),
  googleCalendarEventId: text("google_calendar_event_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const eventAttendance = pgTable("event_attendance", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  contactId: integer("contact_id").notNull(),
  role: text("role").default("attendee"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const impactLogs = pgTable("impact_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  transcript: text("transcript"),
  summary: text("summary"),
  rawExtraction: jsonb("raw_extraction"),
  reviewedData: jsonb("reviewed_data"),
  status: text("status").notNull().default("draft"),
  eventId: integer("event_id"),
  sentiment: text("sentiment"),
  milestones: text("milestones").array(),
  keyQuotes: text("key_quotes").array(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const impactLogContacts = pgTable("impact_log_contacts", {
  id: serial("id").primaryKey(),
  impactLogId: integer("impact_log_id").notNull(),
  contactId: integer("contact_id").notNull(),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const impactTaxonomy = pgTable("impact_taxonomy", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color"),
  active: boolean("active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const impactTags = pgTable("impact_tags", {
  id: serial("id").primaryKey(),
  impactLogId: integer("impact_log_id").notNull(),
  taxonomyId: integer("taxonomy_id").notNull(),
  confidence: integer("confidence"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const keywordDictionary = pgTable("keyword_dictionary", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  phrase: text("phrase").notNull(),
  taxonomyId: integer("taxonomy_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const actionItems = pgTable("action_items", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id"),
  impactLogId: integer("impact_log_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const consentRecords = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  action: text("action").notNull(),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dismissedCalendarEvents = pgTable("dismissed_calendar_events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  gcalEventId: text("gcal_event_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const calendarSettings = pgTable("calendar_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  calendarId: text("calendar_id").notNull(),
  label: text("label"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const GROUP_TYPES = [
  "Organisation",
  "Collective",
  "Whānau Group",
  "Business",
  "Community Group",
  "Government",
  "Other",
] as const;
export type GroupType = typeof GROUP_TYPES[number];

export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("Organisation"),
  description: text("description"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  address: text("address"),
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  contactId: integer("contact_id").notNull(),
  role: text("role").default("member"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const programmes = pgTable("programmes", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  classification: text("classification").notNull(),
  status: text("status").notNull().default("planned"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  tbcMonth: text("tbc_month"),
  tbcYear: text("tbc_year"),
  location: text("location"),
  facilitatorCost: numeric("facilitator_cost", { precision: 10, scale: 2 }).default("0"),
  cateringCost: numeric("catering_cost", { precision: 10, scale: 2 }).default("0"),
  promoCost: numeric("promo_cost", { precision: 10, scale: 2 }).default("0"),
  facilitators: integer("facilitators").array(),
  attendees: integer("attendees").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  capacity: integer("capacity"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  venueId: integer("venue_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  classification: text("classification").notNull(),
  status: text("status").notNull().default("enquiry"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  tbcMonth: text("tbc_month"),
  tbcYear: text("tbc_year"),
  pricingTier: text("pricing_tier").notNull().default("full_price"),
  amount: numeric("amount", { precision: 10, scale: 2 }).default("0"),
  bookerId: integer("booker_id"),
  bookerGroupId: integer("booker_group_id"),
  attendees: integer("attendees").array(),
  attendeeCount: integer("attendee_count"),
  membershipId: integer("membership_id"),
  mouId: integer("mou_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const MEMBERSHIP_STATUSES = ["active", "expired", "pending"] as const;
export type MembershipStatus = typeof MEMBERSHIP_STATUSES[number];

export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id"),
  groupId: integer("group_id"),
  name: text("name").notNull(),
  annualFee: numeric("annual_fee", { precision: 10, scale: 2 }).default("0"),
  venueHireHours: integer("venue_hire_hours").default(0),
  bookingAllowance: integer("booking_allowance").default(0),
  allowancePeriod: text("allowance_period").default("quarterly"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("pending"),
  paymentStatus: text("payment_status").default("unpaid"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const MOU_STATUSES = ["draft", "active", "expired", "terminated"] as const;
export type MouStatus = typeof MOU_STATUSES[number];

export const mous = pgTable("mous", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id"),
  groupId: integer("group_id"),
  title: text("title").notNull(),
  partnerName: text("partner_name"),
  providing: text("providing"),
  receiving: text("receiving"),
  inKindValue: numeric("in_kind_value", { precision: 10, scale: 2 }).default("0"),
  bookingAllowance: integer("booking_allowance").default(0),
  allowancePeriod: text("allowance_period").default("quarterly"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const programmeEvents = pgTable("programme_events", {
  id: serial("id").primaryKey(),
  programmeId: integer("programme_id").notNull(),
  eventId: integer("event_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const groupsRelations = relations(groups, ({ many }) => ({
  members: many(groupMembers),
  memberships: many(memberships),
  mous: many(mous),
  bookings: many(bookings),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups, {
    fields: [groupMembers.groupId],
    references: [groups.id],
  }),
  contact: one(contacts, {
    fields: [groupMembers.contactId],
    references: [contacts.id],
  }),
}));

export const venuesRelations = relations(venues, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  venue: one(venues, {
    fields: [bookings.venueId],
    references: [venues.id],
  }),
  booker: one(contacts, {
    fields: [bookings.bookerId],
    references: [contacts.id],
  }),
  bookerGroup: one(groups, {
    fields: [bookings.bookerGroupId],
    references: [groups.id],
  }),
  membership: one(memberships, {
    fields: [bookings.membershipId],
    references: [memberships.id],
  }),
  mou: one(mous, {
    fields: [bookings.mouId],
    references: [mous.id],
  }),
}));

export const membershipsRelations = relations(memberships, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [memberships.contactId],
    references: [contacts.id],
  }),
  group: one(groups, {
    fields: [memberships.groupId],
    references: [groups.id],
  }),
  bookings: many(bookings),
}));

export const mousRelations = relations(mous, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [mous.contactId],
    references: [contacts.id],
  }),
  group: one(groups, {
    fields: [mous.groupId],
    references: [groups.id],
  }),
  bookings: many(bookings),
}));

export const programmesRelations = relations(programmes, ({ many }) => ({
  programmeEvents: many(programmeEvents),
}));

export const programmeEventsRelations = relations(programmeEvents, ({ one }) => ({
  programme: one(programmes, {
    fields: [programmeEvents.programmeId],
    references: [programmes.id],
  }),
  event: one(events, {
    fields: [programmeEvents.eventId],
    references: [events.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  interactions: many(interactions),
  meetings: many(meetings),
  eventAttendance: many(eventAttendance),
  impactLogContacts: many(impactLogContacts),
  actionItems: many(actionItems),
  groupMemberships: many(groupMembers),
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

export const eventsRelations = relations(events, ({ many }) => ({
  eventAttendance: many(eventAttendance),
  impactLogs: many(impactLogs),
}));

export const eventAttendanceRelations = relations(eventAttendance, ({ one }) => ({
  event: one(events, {
    fields: [eventAttendance.eventId],
    references: [events.id],
  }),
  contact: one(contacts, {
    fields: [eventAttendance.contactId],
    references: [contacts.id],
  }),
}));

export const impactLogsRelations = relations(impactLogs, ({ one, many }) => ({
  event: one(events, {
    fields: [impactLogs.eventId],
    references: [events.id],
  }),
  impactLogContacts: many(impactLogContacts),
  impactTags: many(impactTags),
  actionItems: many(actionItems),
}));

export const impactLogContactsRelations = relations(impactLogContacts, ({ one }) => ({
  impactLog: one(impactLogs, {
    fields: [impactLogContacts.impactLogId],
    references: [impactLogs.id],
  }),
  contact: one(contacts, {
    fields: [impactLogContacts.contactId],
    references: [contacts.id],
  }),
}));

export const impactTaxonomyRelations = relations(impactTaxonomy, ({ many }) => ({
  impactTags: many(impactTags),
  keywordDictionary: many(keywordDictionary),
}));

export const impactTagsRelations = relations(impactTags, ({ one }) => ({
  impactLog: one(impactLogs, {
    fields: [impactTags.impactLogId],
    references: [impactLogs.id],
  }),
  taxonomy: one(impactTaxonomy, {
    fields: [impactTags.taxonomyId],
    references: [impactTaxonomy.id],
  }),
}));

export const keywordDictionaryRelations = relations(keywordDictionary, ({ one }) => ({
  taxonomy: one(impactTaxonomy, {
    fields: [keywordDictionary.taxonomyId],
    references: [impactTaxonomy.id],
  }),
}));

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
  contact: one(contacts, {
    fields: [actionItems.contactId],
    references: [contacts.id],
  }),
  impactLog: one(impactLogs, {
    fields: [actionItems.impactLogId],
    references: [impactLogs.id],
  }),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  contact: one(contacts, {
    fields: [consentRecords.contactId],
    references: [contacts.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertGroupSchema = createInsertSchema(groups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  type: z.enum(GROUP_TYPES).default("Organisation"),
});

export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({
  id: true,
  createdAt: true,
});

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

export const insertEventAttendanceSchema = createInsertSchema(eventAttendance).omit({
  id: true,
  createdAt: true,
});

export const insertImpactLogSchema = createInsertSchema(impactLogs).omit({
  id: true,
  createdAt: true,
});

export const insertImpactLogContactSchema = createInsertSchema(impactLogContacts).omit({
  id: true,
  createdAt: true,
});

export const insertImpactTaxonomySchema = createInsertSchema(impactTaxonomy).omit({
  id: true,
  createdAt: true,
});

export const insertImpactTagSchema = createInsertSchema(impactTags).omit({
  id: true,
  createdAt: true,
});

export const insertKeywordDictionarySchema = createInsertSchema(keywordDictionary).omit({
  id: true,
  createdAt: true,
});

export const insertActionItemSchema = createInsertSchema(actionItems).omit({
  id: true,
  createdAt: true,
});

export const insertConsentRecordSchema = createInsertSchema(consentRecords).omit({
  id: true,
  createdAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
  id: true,
  createdAt: true,
});

// === EXPLICIT API CONTRACT TYPES ===
export type Group = typeof groups.$inferSelect;
export type InsertGroup = z.infer<typeof insertGroupSchema>;

export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = z.infer<typeof insertGroupMemberSchema>;

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

export type EventAttendance = typeof eventAttendance.$inferSelect;
export type InsertEventAttendance = z.infer<typeof insertEventAttendanceSchema>;

export type ImpactLog = typeof impactLogs.$inferSelect;
export type InsertImpactLog = z.infer<typeof insertImpactLogSchema>;

export type ImpactLogContact = typeof impactLogContacts.$inferSelect;
export type InsertImpactLogContact = z.infer<typeof insertImpactLogContactSchema>;

export type ImpactTaxonomy = typeof impactTaxonomy.$inferSelect;
export type InsertImpactTaxonomy = z.infer<typeof insertImpactTaxonomySchema>;

export type ImpactTag = typeof impactTags.$inferSelect;
export type InsertImpactTag = z.infer<typeof insertImpactTagSchema>;

export type KeywordDictionary = typeof keywordDictionary.$inferSelect;
export type InsertKeywordDictionary = z.infer<typeof insertKeywordDictionarySchema>;

export type ActionItem = typeof actionItems.$inferSelect;
export type InsertActionItem = z.infer<typeof insertActionItemSchema>;

export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertConsentRecord = z.infer<typeof insertConsentRecordSchema>;

export type AuditLog = typeof auditLog.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export const insertDismissedCalendarEventSchema = createInsertSchema(dismissedCalendarEvents).omit({
  id: true,
  createdAt: true,
});

export const insertCalendarSettingsSchema = createInsertSchema(calendarSettings).omit({
  id: true,
  createdAt: true,
});

export type DismissedCalendarEvent = typeof dismissedCalendarEvents.$inferSelect;
export type InsertDismissedCalendarEvent = z.infer<typeof insertDismissedCalendarEventSchema>;

export type CalendarSetting = typeof calendarSettings.$inferSelect;
export type InsertCalendarSetting = z.infer<typeof insertCalendarSettingsSchema>;

export const PROGRAMME_CLASSIFICATIONS = [
  "Community Workshop",
  "Creative Workshop",
  "Youth Workshop",
  "Talks",
  "Networking",
] as const;

export type ProgrammeClassification = typeof PROGRAMME_CLASSIFICATIONS[number];

export const PROGRAMME_STATUSES = ["planned", "active", "completed", "cancelled"] as const;
export type ProgrammeStatus = typeof PROGRAMME_STATUSES[number];

export const insertProgrammeSchema = createInsertSchema(programmes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  classification: z.enum(PROGRAMME_CLASSIFICATIONS),
  status: z.enum(PROGRAMME_STATUSES).default("planned"),
});

export const insertProgrammeEventSchema = createInsertSchema(programmeEvents).omit({
  id: true,
  createdAt: true,
});

export type Programme = typeof programmes.$inferSelect;
export type InsertProgramme = z.infer<typeof insertProgrammeSchema>;

export type ProgrammeEvent = typeof programmeEvents.$inferSelect;
export type InsertProgrammeEvent = z.infer<typeof insertProgrammeEventSchema>;

export const BOOKING_CLASSIFICATIONS = [
  "Workshop",
  "Community Event",
  "Private Hire",
  "Rehearsal",
  "Meeting",
  "Pop-up",
  "Other",
] as const;

export type BookingClassification = typeof BOOKING_CLASSIFICATIONS[number];

export const BOOKING_STATUSES = ["enquiry", "confirmed", "completed", "cancelled"] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

export const PRICING_TIERS = ["full_price", "discounted", "free_koha"] as const;
export type PricingTier = typeof PRICING_TIERS[number];

export const insertVenueSchema = createInsertSchema(venues).omit({
  id: true,
  createdAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  classification: z.enum(BOOKING_CLASSIFICATIONS),
  status: z.enum(BOOKING_STATUSES).default("enquiry"),
  pricingTier: z.enum(PRICING_TIERS).default("full_price"),
});

export type Venue = typeof venues.$inferSelect;
export type InsertVenue = z.infer<typeof insertVenueSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export const PAYMENT_STATUSES = ["unpaid", "paid", "partial", "refunded"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(MEMBERSHIP_STATUSES).default("pending"),
  paymentStatus: z.enum(PAYMENT_STATUSES).default("unpaid"),
});

export const insertMouSchema = createInsertSchema(mous).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(MOU_STATUSES).default("draft"),
});

export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;

export type Mou = typeof mous.$inferSelect;
export type InsertMou = z.infer<typeof insertMouSchema>;

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
    confidenceScore: number;
    systemsInPlace: number;
    fundingReadiness: number;
    networkStrength: number;
  };
};

export type ContactResponse = Contact & {
  interactions?: Interaction[];
};
