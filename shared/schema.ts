import { pgTable, text, serial, integer, boolean, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Import auth tables to export them (REQUIRED for Replit Auth)
export * from "./models/auth";
export * from "./models/chat";

export const RELATIONSHIP_STAGES = [
  "new",
  "engaged",
  "active",
  "deepening",
  "partner",
  "alumni",
] as const;
export type RelationshipStage = typeof RELATIONSHIP_STAGES[number];

export const MILESTONE_TYPES = [
  "funding_secured",
  "business_launched",
  "collaboration_formed",
  "job_created",
  "prototype_completed",
  "revenue_milestone",
  "brand_launched",
  "content_published",
  "community_formed",
  "sponsorship_secured",
  "event_hosted",
  "movement_milestone",
  "grant_received",
  "social_impact",
  "other",
] as const;
export type MilestoneType = typeof MILESTONE_TYPES[number];

// === TABLE DEFINITIONS ===

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Links to users.id from auth
  name: text("name").notNull(),
  nickname: text("nickname"),
  businessName: text("business_name"),
  ventureType: text("venture_type"),
  role: text("role").notNull(), // 'Entrepreneur', 'Creative', 'Community Leader', 'Movement Builder', 'Professional', 'Innovator', 'Rangatahi', 'Aspiring', 'Business Owner'
  email: text("email"),
  phone: text("phone"),
  age: integer("age"),
  ethnicity: text("ethnicity").array(),
  location: text("location"),
  suburb: text("suburb"),
  localBoard: text("local_board"),
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
    communityImpact?: number;
    digitalPresence?: number;
  }>().default({}), 
  notes: text("notes"),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  consentStatus: text("consent_status").default("pending"),
  consentDate: timestamp("consent_date"),
  consentNotes: text("consent_notes"),
  stage: text("stage"), // kakano, tipu, ora, inactive
  whatTheyAreBuilding: text("what_they_are_building"),
  stageProgression: jsonb("stage_progression").$type<Array<{ stage: string; date: string; notes?: string }>>(),
  relationshipStage: text("relationship_stage").default("new"),
  isCommunityMember: boolean("is_community_member").default(false),
  communityMemberOverride: boolean("community_member_override").default(false),
  relationshipCircle: text("relationship_circle"),
  relationshipCircleOverride: boolean("relationship_circle_override").default(false),
  importSource: text("import_source"),
  lastActiveDate: timestamp("last_active_date"),
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
  status: text("status").notNull().default("scheduled"), // scheduled, confirmed, completed, cancelled, no-show
  location: text("location"),
  type: text("type").default("mentoring"), // mentoring, catchup, follow-up
  duration: integer("duration").default(30),
  bookingSource: text("booking_source").default("internal"), // internal, public_link, calendar_import
  notes: text("notes"),
  mentoringFocus: text("mentoring_focus"),
  interactionId: integer("interaction_id"),
  coMentorProfileId: integer("co_mentor_profile_id"),
  meetingTypeId: integer("meeting_type_id"),
  googleCalendarEventId: text("google_calendar_event_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mentorAvailability = pgTable("mentor_availability", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Mon, 6=Sun
  startTime: text("start_time").notNull(), // "09:00"
  endTime: text("end_time").notNull(), // "17:00"
  slotDuration: integer("slot_duration").default(30),
  bufferMinutes: integer("buffer_minutes").default(15),
  isActive: boolean("is_active").default(true),
  maxDailyBookings: integer("max_daily_bookings"),
  category: text("category").default("mentoring"),
});

export const meetingTypes = pgTable("meeting_types", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  duration: integer("duration").notNull().default(30),
  focus: text("focus"),
  color: text("color").default("#3b82f6"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  category: text("category").default("mentoring"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const mentorProfiles = pgTable("mentor_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  mentorUserId: text("mentor_user_id"),
  name: text("name").notNull(),
  email: text("email"),
  isActive: boolean("is_active").default(true),
  googleCalendarId: text("google_calendar_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'Meeting', 'Mentoring Session', 'External Event', 'Personal Development', 'Programme Session', 'Booking', 'Personal', 'Other'
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"),
  attendeeCount: integer("attendee_count"),
  description: text("description"),
  tags: text("tags").array(),
  googleCalendarEventId: text("google_calendar_event_id"),
  linkedProgrammeId: integer("linked_programme_id"),
  linkedBookingId: integer("linked_booking_id"),
  source: text("source").default("internal"), // 'google', 'internal'
  requiresDebrief: boolean("requires_debrief").default(false),
  eventStatus: text("event_status").default("active"), // 'active', 'cancelled'
  debriefSkippedReason: text("debrief_skipped_reason"),
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
  type: text("type").notNull().default("debrief"),
  transcript: text("transcript"),
  summary: text("summary"),
  rawExtraction: jsonb("raw_extraction"),
  reviewedData: jsonb("reviewed_data"),
  status: text("status").notNull().default("draft"),
  eventId: integer("event_id"),
  programmeId: integer("programme_id"),
  sentiment: text("sentiment"),
  milestones: text("milestones").array(),
  keyQuotes: text("key_quotes").array(),
  funderTags: text("funder_tags").array(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  confirmedAt: timestamp("confirmed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const impactLogContacts = pgTable("impact_log_contacts", {
  id: serial("id").primaryKey(),
  impactLogId: integer("impact_log_id").notNull(),
  contactId: integer("contact_id").notNull(),
  role: text("role"),
  confidence: integer("confidence"),
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
  evidence: text("evidence"),
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
  "Community Group",
  "Community Collective",
  "Whānau Group",
  "Business",
  "Social Enterprise",
  "Creative Collective",
  "Movement",
  "Cultural Initiative",
  "Resident Company",
  "Partner",
  "Government",
  "Iwi",
  "NGO",
  "Education",
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
  website: text("website"),
  notes: text("notes"),
  relationshipStage: text("relationship_stage").default("new"),
  relationshipTier: text("relationship_tier").default("mentioned"),
  relationshipStrength: integer("relationship_strength"),
  strategicImportance: text("strategic_importance"),
  ecosystemRoles: text("ecosystem_roles").array(),
  importSource: text("import_source"),
  isCommunity: boolean("is_community").default(false),
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

export const groupTaxonomyLinks = pgTable("group_taxonomy_links", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  taxonomyId: integer("taxonomy_id").notNull(),
  confidence: integer("confidence"),
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dismissedDuplicates = pgTable("dismissed_duplicates", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  entityType: text("entity_type").notNull(),
  entityId1: integer("entity_id_1").notNull(),
  entityId2: integer("entity_id_2").notNull(),
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
  funderTags: text("funder_tags").array(),
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
  title: text("title"),
  description: text("description"),
  classification: text("classification").notNull(),
  status: text("status").notNull().default("enquiry"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  startTime: text("start_time"),
  endTime: text("end_time"),
  isMultiDay: boolean("is_multi_day").default(false),
  tbcMonth: text("tbc_month"),
  tbcYear: text("tbc_year"),
  pricingTier: text("pricing_tier").notNull().default("full_price"),
  durationType: text("duration_type").default("hourly"),
  rateType: text("rate_type").default("standard"),
  amount: numeric("amount", { precision: 10, scale: 2 }).default("0"),
  bookerId: integer("booker_id"),
  bookerGroupId: integer("booker_group_id"),
  attendees: integer("attendees").array(),
  attendeeCount: integer("attendee_count"),
  membershipId: integer("membership_id"),
  mouId: integer("mou_id"),
  funderTags: text("funder_tags").array(),
  notes: text("notes"),
  specialRequests: text("special_requests"),
  confirmationSent: boolean("confirmation_sent").default(false),
  instructionsSent: boolean("instructions_sent").default(false),
  postSurveySent: boolean("post_survey_sent").default(false),
  bookingSource: text("booking_source").default("manual"),
  confirmedBy: integer("confirmed_by"),
  confirmedAt: timestamp("confirmed_at"),
  completedBy: integer("completed_by"),
  completedAt: timestamp("completed_at"),
  isFirstBooking: boolean("is_first_booking").default(false),
  discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).default("0"),
  usePackageCredit: boolean("use_package_credit").default(false),
  isAfterHours: boolean("is_after_hours").default(false),
  autoInstructionsSent: boolean("auto_instructions_sent").default(false),
  autoInstructionsSentAt: timestamp("auto_instructions_sent_at"),
  xeroInvoiceId: text("xero_invoice_id"),
  xeroInvoiceNumber: text("xero_invoice_number"),
  xeroInvoiceStatus: text("xero_invoice_status"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const BOOKING_SOURCES = ["manual", "regular_booker_calendar", "public_inquiry"] as const;
export type BookingSource = typeof BOOKING_SOURCES[number];

export const REGULAR_BOOKER_STATUSES = ["active", "inactive", "suspended"] as const;
export type RegularBookerStatus = typeof REGULAR_BOOKER_STATUSES[number];

export const PAYMENT_TERMS = ["immediate", "net_7", "net_14", "net_30"] as const;
export type PaymentTerms = typeof PAYMENT_TERMS[number];

export const regularBookers = pgTable("regular_bookers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id").notNull(),
  organizationName: text("organization_name"),
  billingEmail: text("billing_email").notNull(),
  billingAddress: text("billing_address"),
  billingPhone: text("billing_phone"),
  pricingTier: text("pricing_tier").notNull().default("full_price"),
  discountPercentage: numeric("discount_percentage", { precision: 5, scale: 2 }).default("0"),
  kohaMouNotes: text("koha_mou_notes"),
  hasBookingPackage: boolean("has_booking_package").default(false),
  packageTotalBookings: integer("package_total_bookings").default(0),
  packageUsedBookings: integer("package_used_bookings").default(0),
  packageExpiresAt: timestamp("package_expires_at"),
  loginEmail: text("login_email"),
  loginToken: text("login_token"),
  loginTokenExpiry: timestamp("login_token_expiry"),
  loginEnabled: boolean("login_enabled").default(false),
  canViewCalendar: boolean("can_view_calendar").default(true),
  canSelfBook: boolean("can_self_book").default(true),
  membershipId: integer("membership_id"),
  mouId: integer("mou_id"),
  xeroContactId: text("xero_contact_id"),
  paymentTerms: text("payment_terms").default("immediate"),
  accountStatus: text("account_status").notNull().default("active"),
  notes: text("notes"),
  usualBookingNeeds: text("usual_booking_needs"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const INSTRUCTION_TYPES = ["access", "arrival", "departure", "emergency", "general"] as const;
export type InstructionType = typeof INSTRUCTION_TYPES[number];

export const venueInstructions = pgTable("venue_instructions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  instructionType: text("instruction_type").notNull(),
  title: text("title"),
  content: text("content"),
  isActive: boolean("is_active").default(true),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const SURVEY_TYPES = ["post_booking"] as const;
export type SurveyType = typeof SURVEY_TYPES[number];

export const SURVEY_STATUSES = ["pending", "sent", "completed", "expired"] as const;
export type SurveyStatus = typeof SURVEY_STATUSES[number];

export const surveys = pgTable("surveys", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  surveyType: text("survey_type").notNull().default("post_booking"),
  relatedId: integer("related_id"),
  contactId: integer("contact_id"),
  questions: jsonb("questions").$type<Array<{
    id: number;
    type: string;
    question: string;
    scale?: number;
    required: boolean;
    consent?: boolean;
    subtext?: string;
  }>>().default([]),
  responses: jsonb("responses").$type<Array<{
    questionId: number;
    answer: string | number | boolean;
  }>>(),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default("pending"),
  manuallyTriggered: boolean("manually_triggered").default(false),
  triggeredBy: integer("triggered_by"),
  surveyToken: text("survey_token"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const MEMBERSHIP_STATUSES = ["active", "expired", "pending"] as const;
export type MembershipStatus = typeof MEMBERSHIP_STATUSES[number];

export const memberships = pgTable("memberships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  contactId: integer("contact_id"),
  groupId: integer("group_id"),
  name: text("name").notNull(),
  standardValue: numeric("standard_value", { precision: 10, scale: 2 }).default("0"),
  annualFee: numeric("annual_fee", { precision: 10, scale: 2 }).default("0"),
  venueHireHours: integer("venue_hire_hours").default(0),
  bookingAllowance: integer("booking_allowance").default(0),
  allowancePeriod: text("allowance_period").default("quarterly"),
  membershipYear: integer("membership_year"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  status: text("status").notNull().default("active"),
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
  actualValue: numeric("actual_value", { precision: 10, scale: 2 }).default("0"),
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

export const impactLogGroups = pgTable("impact_log_groups", {
  id: serial("id").primaryKey(),
  impactLogId: integer("impact_log_id").notNull(),
  groupId: integer("group_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const relationshipStageHistory = pgTable("relationship_stage_history", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  previousStage: text("previous_stage"),
  newStage: text("new_stage").notNull(),
  changedBy: text("changed_by"),
  changedAt: timestamp("changed_at").defaultNow(),
});

export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  milestoneType: text("milestone_type").notNull().default("other"),
  description: text("description"),
  linkedContactId: integer("linked_contact_id"),
  linkedGroupId: integer("linked_group_id"),
  linkedProgrammeId: integer("linked_programme_id"),
  linkedImpactLogId: integer("linked_impact_log_id"),
  valueAmount: numeric("value_amount", { precision: 12, scale: 2 }),
  valueCurrency: text("value_currency").default("NZD"),
  funderTags: text("funder_tags").array(),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const REPORT_TYPES = ["monthly", "quarterly", "ad_hoc"] as const;
export type ReportType = typeof REPORT_TYPES[number];

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  type: text("type").notNull().default("monthly"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  filters: jsonb("filters").$type<{
    programmeIds?: number[];
    taxonomyIds?: number[];
    demographicSegments?: string[];
    funder?: string;
  }>().default({}),
  snapshotData: jsonb("snapshot_data"),
  narrative: text("narrative"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === LEGACY REPORTING ===

export const legacyReports = pgTable("legacy_reports", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  year: integer("year"),
  quarter: integer("quarter"),
  month: integer("month"),
  quarterLabel: text("quarter_label").notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  pdfFileName: text("pdf_file_name"),
  pdfData: text("pdf_data"),
  notes: text("notes"),
  status: text("status").default("draft"),
  confirmedAt: timestamp("confirmed_at"),
  confirmedBy: text("confirmed_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const legacyReportSnapshots = pgTable("legacy_report_snapshots", {
  id: serial("id").primaryKey(),
  legacyReportId: integer("legacy_report_id").notNull(),
  activationsTotal: integer("activations_total").default(0),
  activationsWorkshops: integer("activations_workshops").default(0),
  activationsMentoring: integer("activations_mentoring").default(0),
  activationsEvents: integer("activations_events").default(0),
  activationsPartnerMeetings: integer("activations_partner_meetings").default(0),
  foottrafficUnique: integer("foottraffic_unique"),
  bookingsTotal: integer("bookings_total"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reportingSettings = pgTable("reporting_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  boundaryDate: timestamp("boundary_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const legacyReportExtractions = pgTable("legacy_report_extractions", {
  id: serial("id").primaryKey(),
  legacyReportId: integer("legacy_report_id").notNull(),
  suggestedMetrics: jsonb("suggested_metrics").$type<Array<{
    metricKey: string;
    metricValue: number | null;
    metricUnit: string | null;
    confidence: number;
    evidenceSnippet: string | null;
  }>>().default([]),
  extractedOrganisations: jsonb("extracted_organisations").$type<Array<{
    name: string;
    type: string;
    description: string | null;
    relationship: string | null;
  }>>().default([]),
  extractedHighlights: jsonb("extracted_highlights").$type<Array<{
    theme: string;
    summary: string;
    activityType: string | null;
  }>>().default([]),
  extractedPeople: jsonb("extracted_people").$type<Array<{
    name: string;
    role: string | null;
    context: string | null;
  }>>().default([]),
  rawText: text("raw_text"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communitySpend = pgTable("community_spend", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  contactId: integer("contact_id"),
  groupId: integer("group_id"),
  programmeId: integer("programme_id"),
  bookingId: integer("booking_id"),
  paymentStatus: text("payment_status").notNull().default("paid"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const weeklyHubDebriefs = pgTable("weekly_hub_debriefs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  weekStartDate: timestamp("week_start_date").notNull(),
  weekEndDate: timestamp("week_end_date").notNull(),
  status: text("status").default("draft"),
  generatedSummaryText: text("generated_summary_text"),
  finalSummaryText: text("final_summary_text"),
  metricsJson: jsonb("metrics_json").$type<Record<string, any>>().default({}),
  themesJson: jsonb("themes_json").$type<string[]>().default([]),
  sentimentJson: jsonb("sentiment_json").$type<{ average: number | null; sampleSize: number; breakdown: Record<string, number> }>(),
  createdAt: timestamp("created_at").defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

export const insertLegacyReportExtractionSchema = createInsertSchema(legacyReportExtractions).omit({
  id: true,
  createdAt: true,
});

export const insertWeeklyHubDebriefSchema = createInsertSchema(weeklyHubDebriefs).omit({
  id: true,
  createdAt: true,
  confirmedAt: true,
});

export type LegacyReportExtraction = typeof legacyReportExtractions.$inferSelect;
export type InsertLegacyReportExtraction = z.infer<typeof insertLegacyReportExtractionSchema>;

export type WeeklyHubDebrief = typeof weeklyHubDebriefs.$inferSelect;
export type InsertWeeklyHubDebrief = z.infer<typeof insertWeeklyHubDebriefSchema>;

export const insertLegacyReportSchema = createInsertSchema(legacyReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLegacyReportSnapshotSchema = createInsertSchema(legacyReportSnapshots).omit({
  id: true,
  createdAt: true,
});

export const insertReportingSettingsSchema = createInsertSchema(reportingSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type LegacyReport = typeof legacyReports.$inferSelect;
export type InsertLegacyReport = z.infer<typeof insertLegacyReportSchema>;

export type LegacyReportSnapshot = typeof legacyReportSnapshots.$inferSelect;
export type InsertLegacyReportSnapshot = z.infer<typeof insertLegacyReportSnapshotSchema>;

export type ReportingSettings = typeof reportingSettings.$inferSelect;
export type InsertReportingSettings = z.infer<typeof insertReportingSettingsSchema>;

export const insertRelationshipStageHistorySchema = createInsertSchema(relationshipStageHistory).omit({
  id: true,
  changedAt: true,
});

export const insertMilestoneSchema = createInsertSchema(milestones).omit({
  id: true,
  createdAt: true,
}).extend({
  milestoneType: z.enum(MILESTONE_TYPES).default("other"),
});

export type RelationshipStageHistoryRecord = typeof relationshipStageHistory.$inferSelect;
export type InsertRelationshipStageHistory = z.infer<typeof insertRelationshipStageHistorySchema>;

export type Milestone = typeof milestones.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;

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
  programme: one(programmes, {
    fields: [impactLogs.programmeId],
    references: [programmes.id],
  }),
  impactLogContacts: many(impactLogContacts),
  impactLogGroups: many(impactLogGroups),
  impactTags: many(impactTags),
  actionItems: many(actionItems),
}));

export const impactLogGroupsRelations = relations(impactLogGroups, ({ one }) => ({
  impactLog: one(impactLogs, {
    fields: [impactLogGroups.impactLogId],
    references: [impactLogs.id],
  }),
  group: one(groups, {
    fields: [impactLogGroups.groupId],
    references: [groups.id],
  }),
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

export const milestonesRelations = relations(milestones, ({ one }) => ({
  contact: one(contacts, {
    fields: [milestones.linkedContactId],
    references: [contacts.id],
  }),
  group: one(groups, {
    fields: [milestones.linkedGroupId],
    references: [groups.id],
  }),
  programme: one(programmes, {
    fields: [milestones.linkedProgrammeId],
    references: [programmes.id],
  }),
  impactLog: one(impactLogs, {
    fields: [milestones.linkedImpactLogId],
    references: [impactLogs.id],
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

export const insertGroupTaxonomyLinkSchema = createInsertSchema(groupTaxonomyLinks).omit({
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

export type GroupTaxonomyLink = typeof groupTaxonomyLinks.$inferSelect;
export type InsertGroupTaxonomyLink = z.infer<typeof insertGroupTaxonomyLinkSchema>;

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

export const insertMeetingTypeSchema = createInsertSchema(meetingTypes).omit({
  id: true,
  createdAt: true,
});
export type MeetingType = typeof meetingTypes.$inferSelect;
export type InsertMeetingType = z.infer<typeof insertMeetingTypeSchema>;

export const insertMentorAvailabilitySchema = createInsertSchema(mentorAvailability).omit({
  id: true,
});

export type MentorAvailability = typeof mentorAvailability.$inferSelect;
export type InsertMentorAvailability = z.infer<typeof insertMentorAvailabilitySchema>;

export const insertMentorProfileSchema = createInsertSchema(mentorProfiles).omit({
  id: true,
  createdAt: true,
});
export type MentorProfile = typeof mentorProfiles.$inferSelect;
export type InsertMentorProfile = z.infer<typeof insertMentorProfileSchema>;

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

export const DURATION_TYPES = ["hourly", "half_day", "full_day"] as const;
export type DurationType = typeof DURATION_TYPES[number];

export const RATE_TYPES = ["standard", "community"] as const;
export type RateType = typeof RATE_TYPES[number];

export const COMMUNITY_DISCOUNT = 0.20;

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
  durationType: z.enum(DURATION_TYPES).default("hourly").optional(),
  rateType: z.enum(RATE_TYPES).default("standard").optional(),
});

export type Venue = typeof venues.$inferSelect;
export type InsertVenue = z.infer<typeof insertVenueSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;

export const bookingPricingDefaults = pgTable("booking_pricing_defaults", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  fullDayRate: text("full_day_rate").default("0"),
  halfDayRate: text("half_day_rate").default("0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertBookingPricingDefaultsSchema = createInsertSchema(bookingPricingDefaults).omit({
  id: true,
  updatedAt: true,
});

export type BookingPricingDefaults = typeof bookingPricingDefaults.$inferSelect;
export type InsertBookingPricingDefaults = z.infer<typeof insertBookingPricingDefaultsSchema>;

export const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const operatingHours = pgTable("operating_hours", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  dayOfWeek: text("day_of_week").notNull(),
  openTime: text("open_time"),
  closeTime: text("close_time"),
  isStaffed: boolean("is_staffed").default(true),
});

export const insertOperatingHoursSchema = createInsertSchema(operatingHours).omit({
  id: true,
});

export type OperatingHours = typeof operatingHours.$inferSelect;
export type InsertOperatingHours = z.infer<typeof insertOperatingHoursSchema>;

export const afterHoursSettings = pgTable("after_hours_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  autoSendEnabled: boolean("auto_send_enabled").default(true),
  sendTimingHours: integer("send_timing_hours").default(4),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAfterHoursSettingsSchema = createInsertSchema(afterHoursSettings).omit({
  id: true,
  updatedAt: true,
});

export type AfterHoursSettings = typeof afterHoursSettings.$inferSelect;
export type InsertAfterHoursSettings = z.infer<typeof insertAfterHoursSettingsSchema>;

export const insertRegularBookerSchema = createInsertSchema(regularBookers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  pricingTier: z.enum(PRICING_TIERS).default("full_price"),
  accountStatus: z.enum(REGULAR_BOOKER_STATUSES).default("active"),
  paymentTerms: z.enum(PAYMENT_TERMS).default("immediate"),
});

export type RegularBooker = typeof regularBookers.$inferSelect;
export type InsertRegularBooker = z.infer<typeof insertRegularBookerSchema>;

export const insertVenueInstructionSchema = createInsertSchema(venueInstructions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  instructionType: z.enum(INSTRUCTION_TYPES),
});

export type VenueInstruction = typeof venueInstructions.$inferSelect;
export type InsertVenueInstruction = z.infer<typeof insertVenueInstructionSchema>;

export const insertSurveySchema = createInsertSchema(surveys).omit({
  id: true,
  createdAt: true,
}).extend({
  surveyType: z.enum(SURVEY_TYPES).default("post_booking"),
  status: z.enum(SURVEY_STATUSES).default("pending"),
});

export type Survey = typeof surveys.$inferSelect;
export type InsertSurvey = z.infer<typeof insertSurveySchema>;

export const PAYMENT_STATUSES = ["unpaid", "paid", "partial", "refunded"] as const;
export type PaymentStatus = typeof PAYMENT_STATUSES[number];

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(MEMBERSHIP_STATUSES).default("active"),
  paymentStatus: z.enum(PAYMENT_STATUSES).default("unpaid"),
});

export const insertMouSchema = createInsertSchema(mous).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(MOU_STATUSES).default("active"),
});

export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;

export type Mou = typeof mous.$inferSelect;
export type InsertMou = z.infer<typeof insertMouSchema>;

export const insertImpactLogGroupSchema = createInsertSchema(impactLogGroups).omit({
  id: true,
  createdAt: true,
});

export type ImpactLogGroup = typeof impactLogGroups.$inferSelect;
export type InsertImpactLogGroup = z.infer<typeof insertImpactLogGroupSchema>;

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  type: z.enum(REPORT_TYPES).default("monthly"),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;

export const insertCommunitySpendSchema = createInsertSchema(communitySpend).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CommunitySpend = typeof communitySpend.$inferSelect;
export type InsertCommunitySpend = z.infer<typeof insertCommunitySpendSchema>;

// === GMAIL IMPORT ===

export const gmailImportHistory = pgTable("gmail_import_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  scanType: text("scan_type").notNull().default("manual"),
  emailsScanned: integer("emails_scanned").default(0),
  contactsCreated: integer("contacts_created").default(0),
  groupsCreated: integer("groups_created").default(0),
  contactsSkipped: integer("contacts_skipped").default(0),
  groupsSkipped: integer("groups_skipped").default(0),
  status: text("status").notNull().default("running"),
  errorMessage: text("error_message"),
  scanFromDate: timestamp("scan_from_date"),
  scanToDate: timestamp("scan_to_date"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const gmailExclusions = pgTable("gmail_exclusions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const gmailSyncSettings = pgTable("gmail_sync_settings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  autoSyncEnabled: boolean("auto_sync_enabled").default(true),
  lastSyncAt: timestamp("last_sync_at"),
  syncIntervalHours: integer("sync_interval_hours").default(24),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGmailImportHistorySchema = createInsertSchema(gmailImportHistory).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertGmailExclusionSchema = createInsertSchema(gmailExclusions).omit({
  id: true,
  createdAt: true,
});

export const insertGmailSyncSettingsSchema = createInsertSchema(gmailSyncSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type GmailImportHistory = typeof gmailImportHistory.$inferSelect;
export type InsertGmailImportHistory = z.infer<typeof insertGmailImportHistorySchema>;

export type GmailExclusion = typeof gmailExclusions.$inferSelect;
export type InsertGmailExclusion = z.infer<typeof insertGmailExclusionSchema>;

export type GmailSyncSettings = typeof gmailSyncSettings.$inferSelect;
export type InsertGmailSyncSettings = z.infer<typeof insertGmailSyncSettingsSchema>;

export const gmailConnectedAccounts = pgTable("gmail_connected_accounts", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  email: text("email").notNull(),
  label: text("label"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  tokenExpiry: timestamp("token_expiry"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertGmailConnectedAccountSchema = createInsertSchema(gmailConnectedAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type GmailConnectedAccount = typeof gmailConnectedAccounts.$inferSelect;
export type InsertGmailConnectedAccount = z.infer<typeof insertGmailConnectedAccountSchema>;

// === FUNDERS ===

export const FUNDER_STATUSES = ["active_funder", "in_conversation", "pending_eoi", "completed"] as const;
export type FunderStatus = typeof FUNDER_STATUSES[number];

export const COMMUNITY_LENS_OPTIONS = ["all", "maori", "pasifika", "maori_pasifika"] as const;
export type CommunityLens = typeof COMMUNITY_LENS_OPTIONS[number];

export const REPORTING_CADENCES = ["monthly", "quarterly", "annual", "adhoc"] as const;
export type ReportingCadence = typeof REPORTING_CADENCES[number];

export const NARRATIVE_STYLES = ["compliance", "story"] as const;
export type NarrativeStyle = typeof NARRATIVE_STYLES[number];

export const FUNDER_DOCUMENT_TYPES = ["contract", "eoi", "framework", "report", "other"] as const;
export type FunderDocumentType = typeof FUNDER_DOCUMENT_TYPES[number];

export const funders = pgTable("funders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  organisation: text("organisation"),
  contactPerson: text("contact_person"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status").notNull().default("in_conversation"),
  communityLens: text("community_lens").notNull().default("all"),
  outcomesFramework: text("outcomes_framework"),
  reportingCadence: text("reporting_cadence").default("quarterly"),
  narrativeStyle: text("narrative_style").default("compliance"),
  prioritySections: text("priority_sections").array(),
  funderTag: text("funder_tag"),
  contractStart: timestamp("contract_start"),
  contractEnd: timestamp("contract_end"),
  nextDeadline: timestamp("next_deadline"),
  reviewDate: timestamp("review_date"),
  notes: text("notes"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFunderSchema = createInsertSchema(funders).omit({
  id: true,
  createdAt: true,
});

export type Funder = typeof funders.$inferSelect;
export type InsertFunder = z.infer<typeof insertFunderSchema>;

export const funderDocuments = pgTable("funder_documents", {
  id: serial("id").primaryKey(),
  funderId: integer("funder_id").notNull(),
  userId: text("user_id").notNull(),
  fileName: text("file_name").notNull(),
  documentType: text("document_type").notNull().default("other"),
  fileData: text("file_data").notNull(),
  fileSize: integer("file_size"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFunderDocumentSchema = createInsertSchema(funderDocuments).omit({
  id: true,
  createdAt: true,
});

export type FunderDocument = typeof funderDocuments.$inferSelect;
export type InsertFunderDocument = z.infer<typeof insertFunderDocumentSchema>;

// === MENTORING JOURNEY TABLES ===

export const JOURNEY_STAGES = ["kakano", "tipu", "ora", "inactive"] as const;
export type JourneyStage = typeof JOURNEY_STAGES[number];

export const VENTURE_TYPES = ["commercial_business", "social_enterprise", "creative_movement", "community_initiative", "exploring"] as const;
export type VentureType = typeof VENTURE_TYPES[number];

export const MENTORING_RELATIONSHIP_STATUSES = ["application", "active", "on_hold", "graduated", "ended"] as const;
export const SESSION_FREQUENCIES = ["weekly", "fortnightly", "monthly"] as const;

export const mentoringRelationships = pgTable("mentoring_relationships", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  groupId: integer("group_id"),
  status: text("status").default("application").notNull(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  focusAreas: text("focus_areas"),
  sessionFrequency: text("session_frequency").default("monthly"),
  lastSessionDate: timestamp("last_session_date"),
  nextSessionDate: timestamp("next_session_date"),
  totalSessions: integer("total_sessions").default(0),
  outcomesAchieved: jsonb("outcomes_achieved").$type<string[]>(),
  graduationNotes: text("graduation_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertMentoringRelationshipSchema = createInsertSchema(mentoringRelationships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type MentoringRelationship = typeof mentoringRelationships.$inferSelect;
export type InsertMentoringRelationship = z.infer<typeof insertMentoringRelationshipSchema>;

export const MENTORING_APPLICATION_STATUSES = ["pending", "accepted", "deferred", "declined"] as const;

export const mentoringApplications = pgTable("mentoring_applications", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull(),
  applicationDate: timestamp("application_date").defaultNow(),
  ventureDescription: text("venture_description"),
  currentStage: text("current_stage"),
  whatStuckOn: text("what_stuck_on"),
  whatNeedHelpWith: text("what_need_help_with"),
  alreadyTried: text("already_tried"),
  whyMentoring: text("why_mentoring"),
  timeCommitmentPerWeek: text("time_commitment_per_week"),
  canCommit3Months: boolean("can_commit_3_months"),
  onboardingAnswers: jsonb("onboarding_answers"),
  status: text("status").default("pending").notNull(),
  reviewedBy: text("reviewed_by"),
  reviewedDate: timestamp("reviewed_date"),
  reviewNotes: text("review_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMentoringApplicationSchema = createInsertSchema(mentoringApplications).omit({
  id: true,
  createdAt: true,
});
export type MentoringApplication = typeof mentoringApplications.$inferSelect;
export type InsertMentoringApplication = z.infer<typeof insertMentoringApplicationSchema>;

export const PROJECT_STATUSES = ["planning", "active", "on_hold", "completed", "cancelled"] as const;
export const PROJECT_TYPES = ["operational", "delivery"] as const;
export const PROJECT_UPDATE_TYPES = ["status_change", "milestone", "note", "blocker", "completed_task"] as const;
export const PROJECT_TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("planning"),
  projectType: text("project_type").notNull().default("operational"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  ownerId: integer("owner_id"),
  teamMembers: jsonb("team_members").$type<number[]>().default([]),
  relatedGroupId: integer("related_group_id"),
  relatedContactIds: jsonb("related_contact_ids").$type<number[]>().default([]),
  goals: text("goals"),
  deliverables: text("deliverables"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectUpdates = pgTable("project_updates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  updateType: text("update_type").notNull().default("note"),
  updateText: text("update_text"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const projectTasks = pgTable("project_tasks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"),
  assigneeId: integer("assignee_id"),
  deadline: timestamp("deadline"),
  taskGroup: text("task_group"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(PROJECT_STATUSES).default("planning"),
  projectType: z.enum(PROJECT_TYPES).default("operational"),
  name: z.string().min(1).max(200),
});

export const insertProjectUpdateSchema = createInsertSchema(projectUpdates).omit({
  id: true,
  createdAt: true,
}).extend({
  updateType: z.enum(PROJECT_UPDATE_TYPES).default("note"),
});

export const insertProjectTaskSchema = createInsertSchema(projectTasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: z.enum(PROJECT_TASK_STATUSES).default("pending"),
  title: z.string().min(1).max(500),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type ProjectUpdate = typeof projectUpdates.$inferSelect;
export type InsertProjectUpdate = z.infer<typeof insertProjectUpdateSchema>;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type InsertProjectTask = z.infer<typeof insertProjectTaskSchema>;

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

export const mentoringOnboardingQuestions = pgTable("mentoring_onboarding_questions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  question: text("question").notNull(),
  fieldType: text("field_type").default("textarea"),
  options: text("options").array(),
  isRequired: boolean("is_required").default(true),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertMentoringOnboardingQuestionSchema = createInsertSchema(mentoringOnboardingQuestions).omit({
  id: true,
  createdAt: true,
});
export type MentoringOnboardingQuestion = typeof mentoringOnboardingQuestions.$inferSelect;
export type InsertMentoringOnboardingQuestion = z.infer<typeof insertMentoringOnboardingQuestionSchema>;
