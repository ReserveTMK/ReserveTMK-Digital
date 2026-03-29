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
  mentorAvailability,
  type MentorAvailability,
  type InsertMentorAvailability,
  meetingTypes,
  type MeetingType,
  type InsertMeetingType,
  mentorProfiles,
  type MentorProfile,
  type InsertMentorProfile,
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
  venues,
  bookings,
  memberships,
  mous,
  groups,
  groupMembers,
  groupTaxonomyLinks,
  type Venue,
  type InsertVenue,
  type Booking,
  type InsertBooking,
  type Membership,
  type InsertMembership,
  type Mou,
  type InsertMou,
  type Group,
  type InsertGroup,
  type GroupMember,
  type InsertGroupMember,
  type GroupTaxonomyLink,
  type InsertGroupTaxonomyLink,
  reports,
  type Report,
  type InsertReport,
  legacyReports,
  legacyReportSnapshots,
  reportingSettings,
  type LegacyReport,
  type InsertLegacyReport,
  type LegacyReportSnapshot,
  type InsertLegacyReportSnapshot,
  type ReportingSettings,
  type InsertReportingSettings,
  milestones,
  relationshipStageHistory,
  type Milestone,
  type InsertMilestone,
  type RelationshipStageHistoryRecord,
  type InsertRelationshipStageHistory,
  impactLogGroups,
  legacyReportExtractions,
  weeklyHubDebriefs,
  type LegacyReportExtraction,
  type InsertLegacyReportExtraction,
  type WeeklyHubDebrief,
  type InsertWeeklyHubDebrief,
  communitySpend,
  type CommunitySpend,
  type InsertCommunitySpend,
  bookingPricingDefaults,
  operatingHours,
  afterHoursSettings,
  type OperatingHours,
  type InsertOperatingHours,
  type AfterHoursSettings,
  type InsertAfterHoursSettings,
  bookingReminderSettings,
  type BookingReminderSettings,
  type InsertBookingReminderSettings,
  DAYS_OF_WEEK,
  xeroSettings,
  type XeroSettings,
  type InsertXeroSettings,
  surveySettings,
  type SurveySettings,
  type InsertSurveySettings,
  bookerLinks,
  type BookerLink,
  type InsertBookerLink,
  type BookingPricingDefaults,
  gmailImportHistory,
  gmailExclusions,
  gmailSyncSettings,
  type GmailImportHistory,
  type InsertGmailImportHistory,
  type GmailExclusion,
  type InsertGmailExclusion,
  type GmailSyncSettings,
  type InsertGmailSyncSettings,
  gmailConnectedAccounts,
  type GmailConnectedAccount,
  type InsertGmailConnectedAccount,
  organisationProfile,
  type OrganisationProfile,
  type InsertOrganisationProfile,
  funders,
  funderDocuments,
  type Funder,
  type InsertFunder,
  type FunderDocument,
  type InsertFunderDocument,
  mentoringRelationships,
  mentoringApplications,
  type MentoringRelationship,
  type InsertMentoringRelationship,
  type MentoringApplication,
  type InsertMentoringApplication,
  projects,
  projectUpdates,
  projectTasks,
  type Project,
  type InsertProject,
  type ProjectUpdate,
  type InsertProjectUpdate,
  type ProjectTask,
  type InsertProjectTask,
  regularBookers,
  venueInstructions,
  surveys,
  type RegularBooker,
  type InsertRegularBooker,
  type VenueInstruction,
  type InsertVenueInstruction,
  type Survey,
  type InsertSurvey,
  mentoringOnboardingQuestions,
  type MentoringOnboardingQuestion,
  type InsertMentoringOnboardingQuestion,
  bookableResources,
  deskBookings,
  gearBookings,
  type BookableResource,
  type InsertBookableResource,
  type DeskBooking,
  type InsertDeskBooking,
  type GearBooking,
  type InsertGearBooking,
  monthlySnapshots,
  reportHighlights,
  type MonthlySnapshot,
  type InsertMonthlySnapshot,
  type ReportHighlight,
  type InsertReportHighlight,
  footTrafficTouchpoints,
  type FootTrafficTouchpoint,
  type InsertFootTrafficTouchpoint,
  catchUpList,
  type CatchUpItem,
  type InsertCatchUpItem,
  programmeRegistrations,
  type ProgrammeRegistration,
  type InsertProgrammeRegistration,
  metricSnapshots,
  type MetricSnapshot,
  type InsertMetricSnapshot,
  bookingChangeRequests,
  type BookingChangeRequest,
  type InsertBookingChangeRequest,
} from "@shared/schema";
import { eq, desc, and, gte, lte, sql, max, count, inArray } from "drizzle-orm";

import { authStorage, type IAuthStorage } from "./replit_integrations/auth/storage";

export interface IStorage {
  // Contacts
  getContacts(userId: string, includeArchived?: boolean): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: number, updates: UpdateContactRequest): Promise<Contact>;
  archiveContact(id: number): Promise<void>;
  restoreContact(id: number): Promise<void>;
  deleteContact(id: number): Promise<void>;

  // Interactions
  getInteraction(id: number): Promise<Interaction | undefined>;
  getInteractions(contactId: number): Promise<Interaction[]>;
  createInteraction(interaction: InsertInteraction): Promise<Interaction>;
  deleteInteraction(id: number): Promise<void>;

  // Meetings
  getMeetings(userId: string): Promise<Meeting[]>;
  getMeeting(id: number): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: number, updates: UpdateMeetingRequest): Promise<Meeting>;
  deleteMeeting(id: number): Promise<void>;

  // Mentor Availability
  getMentorAvailability(userId: string): Promise<MentorAvailability[]>;
  getMentorAvailabilityById(id: number): Promise<MentorAvailability | undefined>;
  createMentorAvailability(slot: InsertMentorAvailability): Promise<MentorAvailability>;
  updateMentorAvailability(id: number, updates: Partial<InsertMentorAvailability>): Promise<MentorAvailability>;
  deleteMentorAvailability(id: number): Promise<void>;

  // Meeting Types
  getMeetingTypes(userId: string): Promise<MeetingType[]>;
  getMeetingType(id: number): Promise<MeetingType | undefined>;
  createMeetingType(data: InsertMeetingType): Promise<MeetingType>;
  updateMeetingType(id: number, updates: Partial<InsertMeetingType>): Promise<MeetingType>;
  deleteMeetingType(id: number): Promise<void>;

  // Mentor Profiles
  getMentorProfiles(userId: string): Promise<MentorProfile[]>;
  getMentorProfile(id: number): Promise<MentorProfile | undefined>;
  createMentorProfile(profile: InsertMentorProfile): Promise<MentorProfile>;
  updateMentorProfile(id: number, updates: Partial<InsertMentorProfile>): Promise<MentorProfile>;
  deleteMentorProfile(id: number): Promise<void>;
  
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

  undismissEvent(eventId: number): Promise<Event>;

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

  // Venues
  getVenues(userId: string): Promise<Venue[]>;
  getVenue(id: number): Promise<Venue | undefined>;
  createVenue(data: InsertVenue): Promise<Venue>;
  updateVenue(id: number, updates: Partial<InsertVenue>): Promise<Venue>;
  deleteVenue(id: number): Promise<void>;

  // Bookings
  getBookings(userId: string): Promise<Booking[]>;
  getBooking(id: number): Promise<Booking | undefined>;
  createBooking(data: InsertBooking): Promise<Booking>;
  updateBooking(id: number, updates: Partial<InsertBooking>): Promise<Booking>;
  deleteBooking(id: number): Promise<void>;

  // Booking Pricing Defaults
  getBookingPricingDefaults(userId: string): Promise<BookingPricingDefaults | undefined>;
  upsertBookingPricingDefaults(userId: string, data: { fullDayRate?: string; halfDayRate?: string; maxAdvanceMonths?: number }): Promise<BookingPricingDefaults>;

  getOperatingHours(userId: string): Promise<OperatingHours[]>;
  upsertOperatingHours(userId: string, data: { dayOfWeek: string; openTime: string | null; closeTime: string | null; isStaffed: boolean }[]): Promise<OperatingHours[]>;
  seedDefaultOperatingHours(userId: string): Promise<OperatingHours[]>;
  getAfterHoursSettings(userId: string): Promise<AfterHoursSettings | undefined>;
  upsertAfterHoursSettings(userId: string, data: { autoSendEnabled?: boolean; sendTimingHours?: number }): Promise<AfterHoursSettings>;

  getXeroSettings(userId: string): Promise<XeroSettings | undefined>;
  upsertXeroSettings(userId: string, data: Partial<InsertXeroSettings>): Promise<XeroSettings>;
  deleteXeroSettings(userId: string): Promise<void>;

  // Regular Bookers
  getRegularBookers(userId: string): Promise<RegularBooker[]>;
  getRegularBooker(id: number): Promise<RegularBooker | undefined>;
  getRegularBookerByContactId(contactId: number): Promise<RegularBooker | undefined>;
  getRegularBookerByLoginEmail(email: string): Promise<RegularBooker | undefined>;

  getBookerLinks(regularBookerId: number): Promise<BookerLink[]>;
  getAllBookerLinks(userId: string): Promise<BookerLink[]>;
  createBookerLink(data: InsertBookerLink): Promise<BookerLink>;
  deleteBookerLink(id: number): Promise<void>;
  getBookerByLinkToken(token: string): Promise<{ booker: RegularBooker; link: BookerLink } | undefined>;
  updateBookerLinkAccess(id: number): Promise<void>;
  updateBookerLinkToken(id: number, token: string, expiry: Date): Promise<BookerLink>;
  getRegularBookerByToken(token: string): Promise<RegularBooker | undefined>;
  createRegularBooker(data: InsertRegularBooker): Promise<RegularBooker>;
  updateRegularBooker(id: number, updates: Partial<InsertRegularBooker>): Promise<RegularBooker>;
  deleteRegularBooker(id: number): Promise<void>;

  // Venue Instructions
  getVenueInstructions(userId: string): Promise<VenueInstruction[]>;
  getVenueInstructionsBySpaceName(userId: string, spaceName: string): Promise<VenueInstruction[]>;
  createVenueInstruction(data: InsertVenueInstruction): Promise<VenueInstruction>;
  updateVenueInstruction(id: number, updates: Partial<InsertVenueInstruction>): Promise<VenueInstruction>;
  deleteVenueInstruction(id: number): Promise<void>;

  // Booking Reminder Settings
  getBookingReminderSettings(userId: string): Promise<BookingReminderSettings | undefined>;
  upsertBookingReminderSettings(userId: string, data: { enabled?: boolean; sendTimingHours?: number }): Promise<BookingReminderSettings>;

  // Survey Settings
  getSurveySettings(userId: string): Promise<SurveySettings | undefined>;
  upsertSurveySettings(userId: string, data: Partial<InsertSurveySettings>): Promise<SurveySettings>;

  // Surveys
  getSurveys(userId: string): Promise<Survey[]>;
  getSurveyByToken(token: string): Promise<Survey | undefined>;
  getSurveyByBookingId(bookingId: number): Promise<Survey | undefined>;
  createSurvey(data: InsertSurvey): Promise<Survey>;
  updateSurvey(id: number, updates: Partial<InsertSurvey>): Promise<Survey>;

  // Memberships
  getMemberships(userId: string): Promise<Membership[]>;
  getMembership(id: number): Promise<Membership | undefined>;
  createMembership(data: InsertMembership): Promise<Membership>;
  updateMembership(id: number, updates: Partial<InsertMembership>): Promise<Membership>;
  deleteMembership(id: number): Promise<void>;

  // MOUs
  getMous(userId: string): Promise<Mou[]>;
  getMou(id: number): Promise<Mou | undefined>;
  createMou(data: InsertMou): Promise<Mou>;
  updateMou(id: number, updates: Partial<InsertMou>): Promise<Mou>;
  deleteMou(id: number): Promise<void>;

  // Groups
  getGroups(userId: string): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  createGroup(data: InsertGroup): Promise<Group>;
  updateGroup(id: number, updates: Partial<InsertGroup>): Promise<Group>;
  deleteGroup(id: number): Promise<void>;

  // Group Members
  getGroupMembers(groupId: number): Promise<GroupMember[]>;
  getContactGroups(contactId: number): Promise<GroupMember[]>;
  addGroupMember(data: InsertGroupMember): Promise<GroupMember>;
  removeGroupMember(id: number): Promise<void>;

  // Group Taxonomy Links
  getGroupTaxonomyLinks(groupId: number): Promise<GroupTaxonomyLink[]>;
  setGroupTaxonomyLinks(groupId: number, links: InsertGroupTaxonomyLink[]): Promise<GroupTaxonomyLink[]>;
  deleteGroupTaxonomyLinks(groupId: number): Promise<void>;

  // Reports
  getReports(userId: string): Promise<Report[]>;
  getReport(id: number): Promise<Report | undefined>;
  createReport(data: InsertReport): Promise<Report>;
  updateReport(id: number, updates: Partial<InsertReport>): Promise<Report>;
  deleteReport(id: number): Promise<void>;

  // Legacy Reports
  getLegacyReports(userId: string): Promise<LegacyReport[]>;
  getLegacyReport(id: number): Promise<LegacyReport | undefined>;
  createLegacyReport(data: InsertLegacyReport): Promise<LegacyReport>;
  updateLegacyReport(id: number, updates: Partial<InsertLegacyReport>): Promise<LegacyReport>;
  deleteLegacyReport(id: number): Promise<void>;

  // Legacy Report Snapshots
  getLegacyReportSnapshot(legacyReportId: number): Promise<LegacyReportSnapshot | undefined>;
  createLegacyReportSnapshot(data: InsertLegacyReportSnapshot): Promise<LegacyReportSnapshot>;
  updateLegacyReportSnapshot(id: number, updates: Partial<InsertLegacyReportSnapshot>): Promise<LegacyReportSnapshot>;

  // Legacy Report Extractions
  getLegacyReportExtraction(legacyReportId: number): Promise<LegacyReportExtraction | undefined>;
  createLegacyReportExtraction(data: InsertLegacyReportExtraction): Promise<LegacyReportExtraction>;
  updateLegacyReportExtraction(id: number, updates: Partial<InsertLegacyReportExtraction>): Promise<LegacyReportExtraction>;

  // Weekly Hub Debriefs
  getWeeklyHubDebriefs(userId: string): Promise<WeeklyHubDebrief[]>;
  getWeeklyHubDebrief(id: number): Promise<WeeklyHubDebrief | undefined>;
  getWeeklyHubDebriefByWeek(userId: string, weekStartDate: Date): Promise<WeeklyHubDebrief | undefined>;
  createWeeklyHubDebrief(data: InsertWeeklyHubDebrief): Promise<WeeklyHubDebrief>;
  updateWeeklyHubDebrief(id: number, updates: Partial<InsertWeeklyHubDebrief>): Promise<WeeklyHubDebrief>;
  deleteWeeklyHubDebrief(id: number): Promise<void>;

  // Reporting Settings
  getReportingSettings(userId: string): Promise<ReportingSettings | undefined>;
  upsertReportingSettings(userId: string, updates: Partial<InsertReportingSettings>): Promise<ReportingSettings>;

  // Milestones
  getMilestones(userId: string): Promise<Milestone[]>;
  getMilestone(id: number): Promise<Milestone | undefined>;
  createMilestone(data: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: number, updates: Partial<InsertMilestone>): Promise<Milestone>;
  deleteMilestone(id: number): Promise<void>;

  // Relationship Stage History
  getRelationshipStageHistory(entityType: string, entityId: number): Promise<RelationshipStageHistoryRecord[]>;
  createRelationshipStageHistory(data: InsertRelationshipStageHistory): Promise<RelationshipStageHistoryRecord>;

  // Community Spend
  getCommunitySpend(userId: string): Promise<CommunitySpend[]>;
  getCommunitySpendItem(id: number): Promise<CommunitySpend | undefined>;
  createCommunitySpend(data: InsertCommunitySpend): Promise<CommunitySpend>;
  updateCommunitySpend(id: number, updates: Partial<InsertCommunitySpend>): Promise<CommunitySpend>;
  deleteCommunitySpend(id: number): Promise<void>;
  getCommunitySpendByProgramme(programmeId: number): Promise<CommunitySpend[]>;

  // Organisation Profile
  getOrganisationProfile(userId: string): Promise<OrganisationProfile | undefined>;
  upsertOrganisationProfile(userId: string, data: Partial<InsertOrganisationProfile>): Promise<OrganisationProfile>;

  // Funders
  getFunders(userId: string): Promise<Funder[]>;
  getFunder(id: number): Promise<Funder | undefined>;
  getFunderByTag(userId: string, funderTag: string): Promise<Funder | undefined>;
  createFunder(data: InsertFunder): Promise<Funder>;
  updateFunder(id: number, updates: Partial<InsertFunder>): Promise<Funder>;
  deleteFunder(id: number): Promise<void>;

  // Funder Documents
  getFunderDocuments(funderId: number): Promise<FunderDocument[]>;
  createFunderDocument(data: InsertFunderDocument): Promise<FunderDocument>;
  deleteFunderDocument(id: number): Promise<void>;
  getFunderDocument(id: number): Promise<FunderDocument | undefined>;

  // Mentoring Relationships
  getMentoringRelationships(): Promise<MentoringRelationship[]>;
  getMentoringRelationship(id: number): Promise<MentoringRelationship | undefined>;
  getMentoringRelationshipsByContact(contactId: number): Promise<MentoringRelationship[]>;
  createMentoringRelationship(data: InsertMentoringRelationship): Promise<MentoringRelationship>;
  updateMentoringRelationship(id: number, updates: Partial<InsertMentoringRelationship>): Promise<MentoringRelationship>;
  deleteMentoringRelationship(id: number): Promise<void>;

  // Mentoring Applications
  getMentoringApplications(): Promise<MentoringApplication[]>;
  getMentoringApplication(id: number): Promise<MentoringApplication | undefined>;
  getMentoringApplicationsByContact(contactId: number): Promise<MentoringApplication[]>;
  createMentoringApplication(data: InsertMentoringApplication): Promise<MentoringApplication>;
  updateMentoringApplication(id: number, updates: Partial<InsertMentoringApplication>): Promise<MentoringApplication>;
  deleteMentoringApplication(id: number): Promise<void>;

  // Mentoring Onboarding Questions
  getMentoringOnboardingQuestions(userId: string): Promise<MentoringOnboardingQuestion[]>;
  getMentoringOnboardingQuestion(id: number): Promise<MentoringOnboardingQuestion | undefined>;
  createMentoringOnboardingQuestion(data: InsertMentoringOnboardingQuestion): Promise<MentoringOnboardingQuestion>;
  updateMentoringOnboardingQuestion(id: number, updates: Partial<InsertMentoringOnboardingQuestion>): Promise<MentoringOnboardingQuestion>;
  deleteMentoringOnboardingQuestion(id: number): Promise<void>;



  // Projects
  getProjects(userId: string): Promise<Project[]>;
  getProject(id: number): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: number, updates: Partial<InsertProject>): Promise<Project>;
  deleteProject(id: number): Promise<void>;
  getProjectUpdates(projectId: number): Promise<ProjectUpdate[]>;
  createProjectUpdate(data: InsertProjectUpdate): Promise<ProjectUpdate>;
  getProjectTasks(projectId: number): Promise<ProjectTask[]>;
  getAllProjectTasks(userId: string): Promise<ProjectTask[]>;
  getProjectTask(id: number): Promise<ProjectTask | undefined>;
  createProjectTask(data: InsertProjectTask): Promise<ProjectTask>;
  updateProjectTask(id: number, updates: Partial<InsertProjectTask>): Promise<ProjectTask>;
  deleteProjectTask(id: number): Promise<void>;

  // Monthly Snapshots
  getMonthlySnapshots(userId: string): Promise<MonthlySnapshot[]>;
  getMonthlySnapshot(id: number): Promise<MonthlySnapshot | undefined>;
  upsertMonthlySnapshot(userId: string, month: Date, data: Partial<InsertMonthlySnapshot>): Promise<MonthlySnapshot>;
  deleteMonthlySnapshot(id: number): Promise<void>;

  // Report Highlights
  getReportHighlights(userId: string): Promise<ReportHighlight[]>;
  getReportHighlight(id: number): Promise<ReportHighlight | undefined>;
  createReportHighlight(data: InsertReportHighlight): Promise<ReportHighlight>;
  deleteReportHighlight(id: number): Promise<void>;

  // Foot Traffic Touchpoints
  getFootTrafficTouchpoints(snapshotId: number): Promise<any[]>;
  createFootTrafficTouchpoint(data: InsertFootTrafficTouchpoint): Promise<FootTrafficTouchpoint>;
  deleteFootTrafficTouchpoint(id: number): Promise<void>;

  // Catch Up List
  getCatchUpList(userId: string): Promise<any[]>;
  getCatchUpListHistory(userId: string): Promise<any[]>;
  getLastCaughtUpDates(userId: string): Promise<{ contactId: number; lastDismissedAt: string }[]>;
  addToCatchUpList(data: InsertCatchUpItem): Promise<CatchUpItem>;
  updateCatchUpItem(id: number, updates: Partial<InsertCatchUpItem>): Promise<CatchUpItem>;
  dismissCatchUpItem(id: number): Promise<CatchUpItem>;
  removeCatchUpItem(id: number): Promise<void>;

  // Programme Registrations
  createProgrammeRegistration(data: InsertProgrammeRegistration): Promise<ProgrammeRegistration>;
  getProgrammeRegistrations(programmeId: number): Promise<ProgrammeRegistration[]>;
  getProgrammeRegistration(id: number): Promise<ProgrammeRegistration | undefined>;
  updateProgrammeRegistration(id: number, updates: Partial<InsertProgrammeRegistration>): Promise<ProgrammeRegistration>;
  deleteProgrammeRegistration(id: number): Promise<void>;
  getProgrammeRegistrationsByContact(contactId: number): Promise<ProgrammeRegistration[]>;
  getProgrammeRegistrationCount(programmeId: number): Promise<number>;
  getProgrammeBySlug(slug: string): Promise<Programme | undefined>;

  // Bookable Resources
  getBookableResources(userId: string): Promise<BookableResource[]>;
  getBookableResourcesByCategory(userId: string, category: string): Promise<BookableResource[]>;
  getBookableResource(id: number): Promise<BookableResource | undefined>;
  createBookableResource(data: InsertBookableResource): Promise<BookableResource>;
  updateBookableResource(id: number, updates: Partial<InsertBookableResource>): Promise<BookableResource>;
  deleteBookableResource(id: number): Promise<void>;

  // Desk Bookings
  getDeskBookings(userId: string): Promise<DeskBooking[]>;
  getDeskBookingsByResource(resourceId: number): Promise<DeskBooking[]>;
  getDeskBookingsByBooker(regularBookerId: number): Promise<DeskBooking[]>;
  getDeskBookingsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<DeskBooking[]>;
  getDeskBooking(id: number): Promise<DeskBooking | undefined>;
  createDeskBooking(data: InsertDeskBooking): Promise<DeskBooking>;
  createDeskBookingWithConflictCheck(data: InsertDeskBooking): Promise<DeskBooking>;
  updateDeskBooking(id: number, updates: Partial<InsertDeskBooking>): Promise<DeskBooking>;
  deleteDeskBooking(id: number): Promise<void>;

  // Gear Bookings
  getGearBookings(userId: string): Promise<GearBooking[]>;
  getGearBookingsByResource(resourceId: number): Promise<GearBooking[]>;
  getGearBookingsByBooker(regularBookerId: number): Promise<GearBooking[]>;
  getGearBookingsByDate(userId: string, date: Date): Promise<GearBooking[]>;
  getGearBooking(id: number): Promise<GearBooking | undefined>;
  createGearBooking(data: InsertGearBooking): Promise<GearBooking>;
  createGearBookingWithConflictCheck(data: InsertGearBooking): Promise<GearBooking>;
  updateGearBooking(id: number, updates: Partial<InsertGearBooking>): Promise<GearBooking>;
  deleteGearBooking(id: number): Promise<void>;
  markGearReturned(id: number): Promise<GearBooking>;
  getLateGearReturns(userId: string): Promise<GearBooking[]>;

  // Metric Snapshots
  createMetricSnapshot(data: InsertMetricSnapshot): Promise<MetricSnapshot>;
  getMetricSnapshots(contactId: number): Promise<MetricSnapshot[]>;
  getMetricSnapshotsByContacts(contactIds: number[], startDate?: Date, endDate?: Date): Promise<MetricSnapshot[]>;

  // Booking Change Requests
  getBookingChangeRequests(userId: string): Promise<BookingChangeRequest[]>;
  getBookingChangeRequest(id: number): Promise<BookingChangeRequest | undefined>;
  getBookingChangeRequestsByBooking(bookingId: number): Promise<BookingChangeRequest[]>;
  createBookingChangeRequest(data: InsertBookingChangeRequest): Promise<BookingChangeRequest>;
  updateBookingChangeRequest(id: number, updates: Partial<InsertBookingChangeRequest>): Promise<BookingChangeRequest>;

  // Auth (re-exported or separate)
  auth: IAuthStorage;
}

export class DatabaseStorage implements IStorage {
  public auth = authStorage;

  // Contacts
  async getContacts(userId: string, includeArchived: boolean = false): Promise<any[]> {
    const interactionStats = db
      .select({
        contactId: interactions.contactId,
        lastInteractionDate: max(interactions.date).as('last_interaction_date'),
        interactionCount: count(interactions.id).as('interaction_count'),
      })
      .from(interactions)
      .groupBy(interactions.contactId)
      .as('int_stats');

    const attendanceStats = db
      .select({
        contactId: eventAttendance.contactId,
        eventCount: count(eventAttendance.id).as('event_count'),
      })
      .from(eventAttendance)
      .groupBy(eventAttendance.contactId)
      .as('att_stats');

    const debriefStats = db
      .select({
        contactId: impactLogContacts.contactId,
        debriefCount: count(impactLogContacts.id).as('debrief_count'),
      })
      .from(impactLogContacts)
      .groupBy(impactLogContacts.contactId)
      .as('deb_stats');

    const rows = await db
      .select({
        contact: contacts,
        lastInteractionDate: interactionStats.lastInteractionDate,
        interactionCount: interactionStats.interactionCount,
        eventCount: attendanceStats.eventCount,
        debriefCount: debriefStats.debriefCount,
      })
      .from(contacts)
      .leftJoin(interactionStats, eq(contacts.id, interactionStats.contactId))
      .leftJoin(attendanceStats, eq(contacts.id, attendanceStats.contactId))
      .leftJoin(debriefStats, eq(contacts.id, debriefStats.contactId))
      .where(includeArchived 
        ? eq(contacts.userId, userId)
        : and(eq(contacts.userId, userId), eq(contacts.isArchived, false))
      )
      .orderBy(desc(sql`COALESCE(${contacts.lastActiveDate}, ${interactionStats.lastInteractionDate}, ${contacts.createdAt})`));

    const allMemberships = await db
      .select({ contactId: groupMembers.contactId, groupId: groupMembers.groupId, groupName: groups.name })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id));

    const contactGroupMap: Record<number, { groupId: number; groupName: string }> = {};
    for (const m of allMemberships) {
      if (!contactGroupMap[m.contactId]) {
        contactGroupMap[m.contactId] = { groupId: m.groupId, groupName: m.groupName };
      }
    }

    return rows.map(r => ({
      ...r.contact,
      lastInteractionDate: r.lastInteractionDate || null,
      interactionCount: Number(r.interactionCount) || 0,
      eventCount: Number(r.eventCount) || 0,
      debriefCount: Number(r.debriefCount) || 0,
      linkedGroupId: contactGroupMap[r.contact.id]?.groupId || null,
      linkedGroupName: contactGroupMap[r.contact.id]?.groupName || null,
    }));
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

  async archiveContact(id: number): Promise<void> {
    await db.update(contacts).set({ isArchived: true, updatedAt: new Date() }).where(eq(contacts.id, id));
  }

  async restoreContact(id: number): Promise<void> {
    await db.update(contacts).set({ isArchived: false, updatedAt: new Date() }).where(eq(contacts.id, id));
  }

  async deleteContact(id: number): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  // Interactions
  async getInteraction(id: number): Promise<Interaction | undefined> {
    const [item] = await db.select().from(interactions).where(eq(interactions.id, id));
    return item;
  }

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
      const hasAnyScore = analysis.mindsetScore !== undefined || analysis.skillScore !== undefined || 
        analysis.confidenceScore !== undefined || analysis.bizConfidenceScore !== undefined || analysis.confidenceScoreMetric !== undefined ||
        analysis.systemsInPlaceScore !== undefined || analysis.fundingReadinessScore !== undefined ||
        analysis.networkStrengthScore !== undefined || analysis.communityImpactScore !== undefined;
      
      if (hasAnyScore) {
        const [existingContact] = await db.select({ metrics: contacts.metrics }).from(contacts).where(eq(contacts.id, insertInteraction.contactId));
        const existingMetrics = (existingContact?.metrics as Record<string, any>) || {};
        
        const newMetrics: Record<string, any> = { ...existingMetrics };
        if (analysis.mindsetScore !== undefined) newMetrics.mindset = analysis.mindsetScore;
        if (analysis.skillScore !== undefined) newMetrics.skill = analysis.skillScore;
        if (analysis.confidenceScore !== undefined) newMetrics.confidence = analysis.confidenceScore;
        if (analysis.bizConfidenceScore !== undefined) newMetrics.bizConfidence = analysis.bizConfidenceScore;
        if (analysis.confidenceScoreMetric !== undefined) newMetrics.confidenceScore = analysis.confidenceScoreMetric;
        if (analysis.systemsInPlaceScore !== undefined) newMetrics.systemsInPlace = analysis.systemsInPlaceScore;
        if (analysis.fundingReadinessScore !== undefined) newMetrics.fundingReadiness = analysis.fundingReadinessScore;
        if (analysis.networkStrengthScore !== undefined) newMetrics.networkStrength = analysis.networkStrengthScore;
        if (analysis.communityImpactScore !== undefined) newMetrics.communityImpact = analysis.communityImpactScore;

        await db.update(contacts)
          .set({
            metrics: newMetrics,
            updatedAt: new Date(),
          })
          .where(eq(contacts.id, insertInteraction.contactId));
      }
    }

    return interaction;
  }

  async deleteInteraction(id: number): Promise<void> {
    await db.delete(interactions).where(eq(interactions.id, id));
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
    await db.transaction(async (tx) => {
      const [meeting] = await tx.select().from(meetings).where(eq(meetings.id, id));
      if (meeting?.interactionId) {
        await tx.delete(interactions).where(eq(interactions.id, meeting.interactionId));
      }
      await tx.delete(meetings).where(eq(meetings.id, id));
    });
  }

  // Mentor Availability
  async getMentorAvailability(userId: string): Promise<MentorAvailability[]> {
    return await db.select()
      .from(mentorAvailability)
      .where(eq(mentorAvailability.userId, userId))
      .orderBy(mentorAvailability.dayOfWeek);
  }

  async getMentorAvailabilityById(id: number): Promise<MentorAvailability | undefined> {
    const [result] = await db.select()
      .from(mentorAvailability)
      .where(eq(mentorAvailability.id, id));
    return result;
  }

  async createMentorAvailability(slot: InsertMentorAvailability): Promise<MentorAvailability> {
    const [result] = await db.insert(mentorAvailability).values(slot).returning();
    return result;
  }

  async updateMentorAvailability(id: number, updates: Partial<InsertMentorAvailability>): Promise<MentorAvailability> {
    const [result] = await db
      .update(mentorAvailability)
      .set(updates)
      .where(eq(mentorAvailability.id, id))
      .returning();
    return result;
  }

  async deleteMentorAvailability(id: number): Promise<void> {
    await db.delete(mentorAvailability).where(eq(mentorAvailability.id, id));
  }

  async getMeetingTypes(userId: string): Promise<MeetingType[]> {
    return await db.select().from(meetingTypes).where(eq(meetingTypes.userId, userId)).orderBy(meetingTypes.sortOrder);
  }

  async getMeetingType(id: number): Promise<MeetingType | undefined> {
    const [result] = await db.select().from(meetingTypes).where(eq(meetingTypes.id, id));
    return result;
  }

  async createMeetingType(data: InsertMeetingType): Promise<MeetingType> {
    const [result] = await db.insert(meetingTypes).values(data).returning();
    return result;
  }

  async updateMeetingType(id: number, updates: Partial<InsertMeetingType>): Promise<MeetingType> {
    const [result] = await db.update(meetingTypes).set(updates).where(eq(meetingTypes.id, id)).returning();
    return result;
  }

  async deleteMeetingType(id: number): Promise<void> {
    await db.delete(meetingTypes).where(eq(meetingTypes.id, id));
  }

  async getMentorProfiles(userId: string): Promise<MentorProfile[]> {
    return await db.select().from(mentorProfiles).where(eq(mentorProfiles.userId, userId)).orderBy(mentorProfiles.name);
  }

  async getMentorProfile(id: number): Promise<MentorProfile | undefined> {
    const [result] = await db.select().from(mentorProfiles).where(eq(mentorProfiles.id, id));
    return result;
  }

  async createMentorProfile(profile: InsertMentorProfile): Promise<MentorProfile> {
    const [result] = await db.insert(mentorProfiles).values(profile).returning();
    return result;
  }

  async updateMentorProfile(id: number, updates: Partial<InsertMentorProfile>): Promise<MentorProfile> {
    const [result] = await db.update(mentorProfiles).set(updates).where(eq(mentorProfiles.id, id)).returning();
    return result;
  }

  async deleteMentorProfile(id: number): Promise<void> {
    await db.delete(mentorProfiles).where(eq(mentorProfiles.id, id));
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
    await db.transaction(async (tx) => {
      await tx.delete(eventAttendance).where(eq(eventAttendance.eventId, id));
      await tx.delete(programmeEvents).where(eq(programmeEvents.eventId, id));
      await tx.delete(events).where(eq(events.id, id));
    });
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
    await db.transaction(async (tx) => {
      await tx.delete(impactLogContacts).where(eq(impactLogContacts.impactLogId, id));
      await tx.delete(impactTags).where(eq(impactTags.impactLogId, id));
      await tx.delete(actionItems).where(eq(actionItems.impactLogId, id));
      await tx.delete(impactLogGroups).where(eq(impactLogGroups.impactLogId, id));
      await tx.delete(impactLogs).where(eq(impactLogs.id, id));
    });
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
    { name: 'Venture Progress', description: 'Capture venture development and economic outcomes. Tangible milestones across businesses, social enterprises, creative projects, and movements.', color: 'green', sortOrder: 2 },
    { name: 'Skills & Capability Growth', description: 'Measure competency development and confidence building. Knowledge acquisition, self-efficacy changes, decision-making improvement.', color: 'purple', sortOrder: 3 },
    { name: 'Network & Ecosystem Connection', description: 'Document relationship formation and ecosystem integration. Introductions, partnerships, mentorship, peer connections established.', color: 'orange', sortOrder: 4 },
    { name: 'Rangatahi Development', description: 'Track youth-specific engagement and outcomes. Participants under 25, youth entrepreneurship development, early-stage ventures.', color: 'pink', sortOrder: 5 },
  ];

  private static readonly SEMANTIC_INDICATORS: Record<string, string[]> = {
    'Hub Engagement': ['registered as member', 'attended workshop', 'came to event', 'used coworking space', 'participated in programme', 'joined session', 'turned up to', 'booked in for', 'regular user', 'used recording studio', 'booked creative space', 'joined movement group'],
    'Venture Progress': ['made first sale', 'got customer', 'launched business', 'registered company', 'earned revenue', 'hired someone', 'secured contract', 'still trading', 'business growing', 'sustainable income', 'wholesale client', 'repeat customer', 'launched brand', 'first sponsorship', 'content going viral', 'secured partnership', 'built audience', 'social media growth', 'earned first income', 'grant received', 'movement growing'],
    'Skills & Capability Growth': ['learned how to', 'now understand', 'figured out how', 'gained confidence', 'feel capable', 'can now do', 'developed skill in', 'understand pricing', 'know how to market', 'improved at', 'making better decisions', 'ready to take next step', 'learned to create content', 'built website', 'designed brand', 'filmed first video', 'built portfolio', 'developed social media strategy'],
    'Network & Ecosystem Connection': ['met someone who', 'introduced to', 'connected with', 'found mentor', 'got referral to', 'partnered with', 'collaborated with', 'supported by', 'linked to', 'now working with', 'relationships with', 'found sponsor', 'connected with brand', 'partnered with collective'],
    'Rangatahi Development': ['young entrepreneur', 'rangatahi participated', 'youth attended', 'first business idea', 'school leaver', 'starting out', 'early career', 'young person', 'student entrepreneur', 'developing mindset', 'youth-led initiative', 'young creative', 'digital creator', 'rangatahi movement', 'first brand'],
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

  async undismissEvent(eventId: number): Promise<Event> {
    const [updated] = await db.update(events)
      .set({ debriefSkippedReason: null })
      .where(eq(events.id, eventId))
      .returning();
    return updated;
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

  // Venues
  async getVenues(userId: string): Promise<Venue[]> {
    return await db.select()
      .from(venues)
      .where(eq(venues.userId, userId))
      .orderBy(desc(venues.createdAt));
  }

  async getVenue(id: number): Promise<Venue | undefined> {
    const [venue] = await db.select().from(venues).where(eq(venues.id, id));
    return venue;
  }

  async createVenue(data: InsertVenue): Promise<Venue> {
    const [venue] = await db.insert(venues).values(data).returning();
    return venue;
  }

  async updateVenue(id: number, updates: Partial<InsertVenue>): Promise<Venue> {
    const [venue] = await db
      .update(venues)
      .set(updates)
      .where(eq(venues.id, id))
      .returning();
    return venue;
  }

  async deleteVenue(id: number): Promise<void> {
    await db.delete(venues).where(eq(venues.id, id));
  }

  // Bookings
  async getBookings(userId: string): Promise<Booking[]> {
    return await db.select()
      .from(bookings)
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.createdAt));
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [booking] = await db.select().from(bookings).where(eq(bookings.id, id));
    return booking;
  }

  async createBooking(data: InsertBooking): Promise<Booking> {
    const [booking] = await db.insert(bookings).values(data).returning();
    return booking;
  }

  async updateBooking(id: number, updates: Partial<InsertBooking>): Promise<Booking> {
    const [booking] = await db
      .update(bookings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return booking;
  }

  async deleteBooking(id: number): Promise<void> {
    await db.transaction(async (tx) => {
      const linkedEvents = await tx.select({ id: events.id }).from(events).where(eq(events.linkedBookingId, id));
      for (const evt of linkedEvents) {
        await tx.delete(eventAttendance).where(eq(eventAttendance.eventId, evt.id));
        await tx.delete(programmeEvents).where(eq(programmeEvents.eventId, evt.id));
      }
      await tx.delete(events).where(eq(events.linkedBookingId, id));
      await tx.delete(surveys).where(and(eq(surveys.surveyType, "post_booking"), eq(surveys.relatedId, id)));
      await tx.delete(bookings).where(eq(bookings.id, id));
    });
  }

  async getBookingPricingDefaults(userId: string): Promise<BookingPricingDefaults | undefined> {
    const [defaults] = await db.select().from(bookingPricingDefaults).where(eq(bookingPricingDefaults.userId, userId));
    return defaults;
  }

  async upsertBookingPricingDefaults(userId: string, data: { fullDayRate?: string; halfDayRate?: string; maxAdvanceMonths?: number }): Promise<BookingPricingDefaults> {
    const existing = await this.getBookingPricingDefaults(userId);
    if (existing) {
      const [updated] = await db.update(bookingPricingDefaults)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(bookingPricingDefaults.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(bookingPricingDefaults)
      .values({ userId, fullDayRate: data.fullDayRate || "0", halfDayRate: data.halfDayRate || "0", maxAdvanceMonths: data.maxAdvanceMonths ?? 3 })
      .returning();
    return created;
  }

  async getOperatingHours(userId: string): Promise<OperatingHours[]> {
    return await db.select().from(operatingHours).where(eq(operatingHours.userId, userId));
  }

  async upsertOperatingHours(userId: string, data: { dayOfWeek: string; openTime: string | null; closeTime: string | null; isStaffed: boolean }[]): Promise<OperatingHours[]> {
    const existing = await this.getOperatingHours(userId);
    const results: OperatingHours[] = [];
    for (const day of data) {
      const found = existing.find(e => e.dayOfWeek === day.dayOfWeek);
      if (found) {
        const [updated] = await db.update(operatingHours)
          .set({ openTime: day.openTime, closeTime: day.closeTime, isStaffed: day.isStaffed })
          .where(eq(operatingHours.id, found.id))
          .returning();
        results.push(updated);
      } else {
        const [created] = await db.insert(operatingHours)
          .values({ userId, dayOfWeek: day.dayOfWeek, openTime: day.openTime, closeTime: day.closeTime, isStaffed: day.isStaffed })
          .returning();
        results.push(created);
      }
    }
    return results;
  }

  async seedDefaultOperatingHours(userId: string): Promise<OperatingHours[]> {
    const existing = await this.getOperatingHours(userId);
    if (existing.length > 0) return existing;
    const defaults = DAYS_OF_WEEK.map(day => ({
      userId,
      dayOfWeek: day,
      openTime: ["saturday", "sunday"].includes(day) ? null : "09:00",
      closeTime: ["saturday", "sunday"].includes(day) ? null : "17:00",
      isStaffed: !["saturday", "sunday"].includes(day),
    }));
    const results: OperatingHours[] = [];
    for (const d of defaults) {
      const [created] = await db.insert(operatingHours).values(d).returning();
      results.push(created);
    }
    return results;
  }

  async getAfterHoursSettings(userId: string): Promise<AfterHoursSettings | undefined> {
    const [settings] = await db.select().from(afterHoursSettings).where(eq(afterHoursSettings.userId, userId));
    return settings;
  }

  async upsertAfterHoursSettings(userId: string, data: { autoSendEnabled?: boolean; sendTimingHours?: number }): Promise<AfterHoursSettings> {
    const existing = await this.getAfterHoursSettings(userId);
    if (existing) {
      const [updated] = await db.update(afterHoursSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(afterHoursSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(afterHoursSettings)
      .values({ userId, autoSendEnabled: data.autoSendEnabled ?? true, sendTimingHours: data.sendTimingHours ?? 4 })
      .returning();
    return created;
  }

  async getBookingReminderSettings(userId: string): Promise<BookingReminderSettings | undefined> {
    const [settings] = await db.select().from(bookingReminderSettings).where(eq(bookingReminderSettings.userId, userId));
    return settings;
  }

  async upsertBookingReminderSettings(userId: string, data: { enabled?: boolean; sendTimingHours?: number }): Promise<BookingReminderSettings> {
    const existing = await this.getBookingReminderSettings(userId);
    if (existing) {
      const [updated] = await db.update(bookingReminderSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(bookingReminderSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(bookingReminderSettings)
      .values({ userId, enabled: data.enabled ?? true, sendTimingHours: data.sendTimingHours ?? 4 })
      .returning();
    return created;
  }

  async getXeroSettings(userId: string): Promise<XeroSettings | undefined> {
    const [settings] = await db.select().from(xeroSettings).where(eq(xeroSettings.userId, userId));
    return settings;
  }

  async upsertXeroSettings(userId: string, data: Partial<InsertXeroSettings>): Promise<XeroSettings> {
    const existing = await this.getXeroSettings(userId);
    if (existing) {
      const [updated] = await db.update(xeroSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(xeroSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(xeroSettings)
      .values({ userId, ...data } as any)
      .returning();
    return created;
  }

  async deleteXeroSettings(userId: string): Promise<void> {
    await db.delete(xeroSettings).where(eq(xeroSettings.userId, userId));
  }

  async getSurveySettings(userId: string): Promise<SurveySettings | undefined> {
    const [settings] = await db.select().from(surveySettings).where(eq(surveySettings.userId, userId));
    return settings;
  }

  async upsertSurveySettings(userId: string, data: Partial<InsertSurveySettings>): Promise<SurveySettings> {
    const existing = await this.getSurveySettings(userId);
    if (existing) {
      const [updated] = await db.update(surveySettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(surveySettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(surveySettings)
      .values({ userId, ...data } as any)
      .returning();
    return created;
  }

  // Regular Bookers
  async getRegularBookers(userId: string): Promise<RegularBooker[]> {
    return await db.select().from(regularBookers).where(eq(regularBookers.userId, userId)).orderBy(desc(regularBookers.createdAt));
  }

  async getRegularBooker(id: number): Promise<RegularBooker | undefined> {
    const [booker] = await db.select().from(regularBookers).where(eq(regularBookers.id, id));
    return booker;
  }

  async getRegularBookerByContactId(contactId: number): Promise<RegularBooker | undefined> {
    const [booker] = await db.select().from(regularBookers).where(eq(regularBookers.contactId, contactId));
    return booker;
  }

  async getRegularBookerByLoginEmail(email: string): Promise<RegularBooker | undefined> {
    const [booker] = await db.select().from(regularBookers).where(eq(regularBookers.loginEmail, email));
    return booker;
  }

  async getRegularBookerByToken(token: string): Promise<RegularBooker | undefined> {
    const [booker] = await db.select().from(regularBookers).where(eq(regularBookers.loginToken, token));
    return booker;
  }

  async createRegularBooker(data: InsertRegularBooker): Promise<RegularBooker> {
    const [booker] = await db.insert(regularBookers).values(data).returning();
    return booker;
  }

  async updateRegularBooker(id: number, updates: Partial<InsertRegularBooker>): Promise<RegularBooker> {
    const [booker] = await db.update(regularBookers).set({ ...updates, updatedAt: new Date() }).where(eq(regularBookers.id, id)).returning();
    return booker;
  }

  async deleteRegularBooker(id: number): Promise<void> {
    await db.delete(bookerLinks).where(eq(bookerLinks.regularBookerId, id));
    await db.delete(regularBookers).where(eq(regularBookers.id, id));
  }

  async getBookerLinks(regularBookerId: number): Promise<BookerLink[]> {
    return await db.select().from(bookerLinks).where(eq(bookerLinks.regularBookerId, regularBookerId)).orderBy(desc(bookerLinks.createdAt));
  }

  async getAllBookerLinks(userId: string): Promise<BookerLink[]> {
    const userBookers = await db.select({ id: regularBookers.id }).from(regularBookers).where(eq(regularBookers.userId, userId));
    if (userBookers.length === 0) return [];
    const bookerIds = userBookers.map(b => b.id);
    return await db.select().from(bookerLinks).where(inArray(bookerLinks.regularBookerId, bookerIds)).orderBy(desc(bookerLinks.createdAt));
  }

  async createBookerLink(data: InsertBookerLink): Promise<BookerLink> {
    const [link] = await db.insert(bookerLinks).values(data).returning();
    return link;
  }

  async deleteBookerLink(id: number): Promise<void> {
    await db.delete(bookerLinks).where(eq(bookerLinks.id, id));
  }

  async getBookerByLinkToken(token: string): Promise<{ booker: RegularBooker; link: BookerLink } | undefined> {
    const [link] = await db.select().from(bookerLinks).where(eq(bookerLinks.token, token));
    if (!link) return undefined;
    const [booker] = await db.select().from(regularBookers).where(eq(regularBookers.id, link.regularBookerId));
    if (!booker) return undefined;
    return { booker, link };
  }

  async updateBookerLinkAccess(id: number): Promise<void> {
    await db.update(bookerLinks).set({ lastAccessedAt: new Date() }).where(eq(bookerLinks.id, id));
  }

  async updateBookerLinkToken(id: number, token: string, expiry: Date): Promise<BookerLink> {
    const [link] = await db.update(bookerLinks).set({ token, tokenExpiry: expiry }).where(eq(bookerLinks.id, id)).returning();
    return link;
  }

  // Venue Instructions
  async getVenueInstructions(userId: string): Promise<VenueInstruction[]> {
    return await db.select().from(venueInstructions).where(eq(venueInstructions.userId, userId)).orderBy(venueInstructions.instructionType, venueInstructions.displayOrder);
  }

  async getVenueInstructionsBySpaceName(userId: string, spaceName: string): Promise<VenueInstruction[]> {
    return await db.select().from(venueInstructions).where(and(eq(venueInstructions.userId, userId), eq(venueInstructions.spaceName, spaceName))).orderBy(venueInstructions.instructionType, venueInstructions.displayOrder);
  }

  async createVenueInstruction(data: InsertVenueInstruction): Promise<VenueInstruction> {
    const [instruction] = await db.insert(venueInstructions).values(data).returning();
    return instruction;
  }

  async updateVenueInstruction(id: number, updates: Partial<InsertVenueInstruction>): Promise<VenueInstruction> {
    const [instruction] = await db.update(venueInstructions).set({ ...updates, updatedAt: new Date() }).where(eq(venueInstructions.id, id)).returning();
    return instruction;
  }

  async deleteVenueInstruction(id: number): Promise<void> {
    await db.delete(venueInstructions).where(eq(venueInstructions.id, id));
  }

  // Surveys
  async getSurveys(userId: string): Promise<Survey[]> {
    return await db.select().from(surveys).where(eq(surveys.userId, userId)).orderBy(desc(surveys.createdAt));
  }

  async getSurveyByToken(token: string): Promise<Survey | undefined> {
    const [survey] = await db.select().from(surveys).where(eq(surveys.surveyToken, token));
    return survey;
  }

  async getSurveyByBookingId(bookingId: number): Promise<Survey | undefined> {
    const [survey] = await db.select().from(surveys).where(and(eq(surveys.surveyType, "post_booking"), eq(surveys.relatedId, bookingId)));
    return survey;
  }

  async createSurvey(data: InsertSurvey): Promise<Survey> {
    const [survey] = await db.insert(surveys).values(data).returning();
    return survey;
  }

  async updateSurvey(id: number, updates: Partial<InsertSurvey>): Promise<Survey> {
    const [survey] = await db.update(surveys).set(updates).where(eq(surveys.id, id)).returning();
    return survey;
  }

  // Memberships
  async getMemberships(userId: string): Promise<Membership[]> {
    return await db.select()
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .orderBy(desc(memberships.createdAt));
  }

  async getMembership(id: number): Promise<Membership | undefined> {
    const [membership] = await db.select().from(memberships).where(eq(memberships.id, id));
    return membership;
  }

  async createMembership(data: InsertMembership): Promise<Membership> {
    const [membership] = await db.insert(memberships).values(data).returning();
    return membership;
  }

  async updateMembership(id: number, updates: Partial<InsertMembership>): Promise<Membership> {
    const [membership] = await db
      .update(memberships)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(memberships.id, id))
      .returning();
    return membership;
  }

  async deleteMembership(id: number): Promise<void> {
    await db.delete(memberships).where(eq(memberships.id, id));
  }

  // MOUs
  async getMous(userId: string): Promise<Mou[]> {
    return await db.select()
      .from(mous)
      .where(eq(mous.userId, userId))
      .orderBy(desc(mous.createdAt));
  }

  async getMou(id: number): Promise<Mou | undefined> {
    const [mou] = await db.select().from(mous).where(eq(mous.id, id));
    return mou;
  }

  async createMou(data: InsertMou): Promise<Mou> {
    const [mou] = await db.insert(mous).values(data).returning();
    return mou;
  }

  async updateMou(id: number, updates: Partial<InsertMou>): Promise<Mou> {
    const [mou] = await db
      .update(mous)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mous.id, id))
      .returning();
    return mou;
  }

  async deleteMou(id: number): Promise<void> {
    await db.delete(mous).where(eq(mous.id, id));
  }

  // Groups
  async getGroups(userId: string): Promise<Group[]> {
    return await db.select()
      .from(groups)
      .where(eq(groups.userId, userId))
      .orderBy(desc(groups.createdAt));
  }

  async getGroup(id: number): Promise<Group | undefined> {
    const [group] = await db.select().from(groups).where(eq(groups.id, id));
    return group;
  }

  async createGroup(data: InsertGroup): Promise<Group> {
    const [group] = await db.insert(groups).values(data).returning();
    return group;
  }

  async updateGroup(id: number, updates: Partial<InsertGroup>): Promise<Group> {
    const [group] = await db
      .update(groups)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(groups.id, id))
      .returning();
    return group;
  }

  async deleteGroup(id: number): Promise<void> {
    await db.delete(groupTaxonomyLinks).where(eq(groupTaxonomyLinks.groupId, id));
    await db.delete(groupMembers).where(eq(groupMembers.groupId, id));
    await db.delete(groups).where(eq(groups.id, id));
  }

  // Group Members
  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    return await db.select()
      .from(groupMembers)
      .where(eq(groupMembers.groupId, groupId));
  }

  async getContactGroups(contactId: number): Promise<(GroupMember & { groupName?: string; groupType?: string })[]> {
    const rows = await db.select({
      id: groupMembers.id,
      groupId: groupMembers.groupId,
      contactId: groupMembers.contactId,
      role: groupMembers.role,
      createdAt: groupMembers.createdAt,
      groupName: groups.name,
      groupType: groups.type,
    })
      .from(groupMembers)
      .innerJoin(groups, eq(groupMembers.groupId, groups.id))
      .where(eq(groupMembers.contactId, contactId));
    return rows;
  }

  async addGroupMember(data: InsertGroupMember): Promise<GroupMember> {
    const [member] = await db.insert(groupMembers).values(data).returning();
    return member;
  }

  async removeGroupMember(id: number): Promise<void> {
    await db.delete(groupMembers).where(eq(groupMembers.id, id));
  }

  async getGroupTaxonomyLinks(groupId: number): Promise<GroupTaxonomyLink[]> {
    return db.select().from(groupTaxonomyLinks).where(eq(groupTaxonomyLinks.groupId, groupId));
  }

  async setGroupTaxonomyLinks(groupId: number, links: InsertGroupTaxonomyLink[]): Promise<GroupTaxonomyLink[]> {
    await db.delete(groupTaxonomyLinks).where(eq(groupTaxonomyLinks.groupId, groupId));
    if (links.length === 0) return [];
    const rows = await db.insert(groupTaxonomyLinks).values(links).returning();
    return rows;
  }

  async deleteGroupTaxonomyLinks(groupId: number): Promise<void> {
    await db.delete(groupTaxonomyLinks).where(eq(groupTaxonomyLinks.groupId, groupId));
  }

  async getReports(userId: string): Promise<Report[]> {
    return await db.select().from(reports).where(eq(reports.userId, userId)).orderBy(desc(reports.createdAt));
  }

  async getReport(id: number): Promise<Report | undefined> {
    const [report] = await db.select().from(reports).where(eq(reports.id, id));
    return report;
  }

  async createReport(data: InsertReport): Promise<Report> {
    const [report] = await db.insert(reports).values(data).returning();
    return report;
  }

  async updateReport(id: number, updates: Partial<InsertReport>): Promise<Report> {
    const [report] = await db
      .update(reports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(reports.id, id))
      .returning();
    return report;
  }

  async deleteReport(id: number): Promise<void> {
    await db.delete(reports).where(eq(reports.id, id));
  }

  // Legacy Reports
  async getLegacyReports(userId: string): Promise<LegacyReport[]> {
    return await db.select().from(legacyReports).where(eq(legacyReports.userId, userId)).orderBy(desc(legacyReports.periodStart));
  }

  async getLegacyReport(id: number): Promise<LegacyReport | undefined> {
    const [report] = await db.select().from(legacyReports).where(eq(legacyReports.id, id));
    return report;
  }

  async createLegacyReport(data: InsertLegacyReport): Promise<LegacyReport> {
    const [report] = await db.insert(legacyReports).values(data).returning();
    return report;
  }

  async updateLegacyReport(id: number, updates: Partial<InsertLegacyReport>): Promise<LegacyReport> {
    const [report] = await db
      .update(legacyReports)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(legacyReports.id, id))
      .returning();
    return report;
  }

  async deleteLegacyReport(id: number): Promise<void> {
    await db.delete(legacyReportSnapshots).where(eq(legacyReportSnapshots.legacyReportId, id));
    await db.delete(legacyReports).where(eq(legacyReports.id, id));
  }

  // Legacy Report Snapshots
  async getLegacyReportSnapshot(legacyReportId: number): Promise<LegacyReportSnapshot | undefined> {
    const [snapshot] = await db.select().from(legacyReportSnapshots).where(eq(legacyReportSnapshots.legacyReportId, legacyReportId));
    return snapshot;
  }

  async createLegacyReportSnapshot(data: InsertLegacyReportSnapshot): Promise<LegacyReportSnapshot> {
    const [snapshot] = await db.insert(legacyReportSnapshots).values(data).returning();
    return snapshot;
  }

  async updateLegacyReportSnapshot(id: number, updates: Partial<InsertLegacyReportSnapshot>): Promise<LegacyReportSnapshot> {
    const [snapshot] = await db
      .update(legacyReportSnapshots)
      .set(updates)
      .where(eq(legacyReportSnapshots.id, id))
      .returning();
    return snapshot;
  }

  // Reporting Settings
  async getReportingSettings(userId: string): Promise<ReportingSettings | undefined> {
    const [settings] = await db.select().from(reportingSettings).where(eq(reportingSettings.userId, userId));
    return settings;
  }

  async upsertReportingSettings(userId: string, updates: Partial<InsertReportingSettings>): Promise<ReportingSettings> {
    const existing = await this.getReportingSettings(userId);
    if (existing) {
      const [updated] = await db
        .update(reportingSettings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(reportingSettings.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(reportingSettings).values({ userId, ...updates }).returning();
    return created;
  }

  // Milestones
  async getMilestones(userId: string): Promise<Milestone[]> {
    return await db.select()
      .from(milestones)
      .where(eq(milestones.userId, userId))
      .orderBy(desc(milestones.createdAt));
  }

  async getMilestone(id: number): Promise<Milestone | undefined> {
    const [milestone] = await db.select().from(milestones).where(eq(milestones.id, id));
    return milestone;
  }

  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    const [milestone] = await db.insert(milestones).values(data).returning();
    return milestone;
  }

  async updateMilestone(id: number, updates: Partial<InsertMilestone>): Promise<Milestone> {
    const [milestone] = await db
      .update(milestones)
      .set(updates)
      .where(eq(milestones.id, id))
      .returning();
    return milestone;
  }

  async deleteMilestone(id: number): Promise<void> {
    await db.delete(milestones).where(eq(milestones.id, id));
  }

  // Relationship Stage History
  async getRelationshipStageHistory(entityType: string, entityId: number): Promise<RelationshipStageHistoryRecord[]> {
    return await db.select()
      .from(relationshipStageHistory)
      .where(and(eq(relationshipStageHistory.entityType, entityType), eq(relationshipStageHistory.entityId, entityId)))
      .orderBy(desc(relationshipStageHistory.changedAt));
  }

  async createRelationshipStageHistory(data: InsertRelationshipStageHistory): Promise<RelationshipStageHistoryRecord> {
    const [record] = await db.insert(relationshipStageHistory).values(data).returning();
    return record;
  }

  async getLegacyReportExtraction(legacyReportId: number): Promise<LegacyReportExtraction | undefined> {
    const [extraction] = await db.select().from(legacyReportExtractions).where(eq(legacyReportExtractions.legacyReportId, legacyReportId));
    return extraction;
  }

  async createLegacyReportExtraction(data: InsertLegacyReportExtraction): Promise<LegacyReportExtraction> {
    const [extraction] = await db.insert(legacyReportExtractions).values(data).returning();
    return extraction;
  }

  async updateLegacyReportExtraction(id: number, updates: Partial<InsertLegacyReportExtraction>): Promise<LegacyReportExtraction> {
    const [extraction] = await db.update(legacyReportExtractions).set(updates).where(eq(legacyReportExtractions.id, id)).returning();
    return extraction;
  }

  async getWeeklyHubDebriefs(userId: string): Promise<WeeklyHubDebrief[]> {
    return await db.select().from(weeklyHubDebriefs).where(eq(weeklyHubDebriefs.userId, userId)).orderBy(desc(weeklyHubDebriefs.weekStartDate));
  }

  async getWeeklyHubDebrief(id: number): Promise<WeeklyHubDebrief | undefined> {
    const [debrief] = await db.select().from(weeklyHubDebriefs).where(eq(weeklyHubDebriefs.id, id));
    return debrief;
  }

  async getWeeklyHubDebriefByWeek(userId: string, weekStartDate: Date): Promise<WeeklyHubDebrief | undefined> {
    const [debrief] = await db.select().from(weeklyHubDebriefs)
      .where(and(eq(weeklyHubDebriefs.userId, userId), eq(weeklyHubDebriefs.weekStartDate, weekStartDate)));
    return debrief;
  }

  async createWeeklyHubDebrief(data: InsertWeeklyHubDebrief): Promise<WeeklyHubDebrief> {
    const [debrief] = await db.insert(weeklyHubDebriefs).values(data).returning();
    return debrief;
  }

  async updateWeeklyHubDebrief(id: number, updates: Partial<InsertWeeklyHubDebrief>): Promise<WeeklyHubDebrief> {
    const [debrief] = await db.update(weeklyHubDebriefs).set(updates).where(eq(weeklyHubDebriefs.id, id)).returning();
    return debrief;
  }

  async deleteWeeklyHubDebrief(id: number): Promise<void> {
    await db.delete(weeklyHubDebriefs).where(eq(weeklyHubDebriefs.id, id));
  }

  async getCommunitySpend(userId: string): Promise<CommunitySpend[]> {
    return db.select().from(communitySpend).where(eq(communitySpend.userId, userId)).orderBy(desc(communitySpend.date));
  }

  async getCommunitySpendItem(id: number): Promise<CommunitySpend | undefined> {
    const [item] = await db.select().from(communitySpend).where(eq(communitySpend.id, id));
    return item;
  }

  async createCommunitySpend(data: InsertCommunitySpend): Promise<CommunitySpend> {
    const [item] = await db.insert(communitySpend).values(data).returning();
    return item;
  }

  async updateCommunitySpend(id: number, updates: Partial<InsertCommunitySpend>): Promise<CommunitySpend> {
    const [item] = await db.update(communitySpend).set({ ...updates, updatedAt: new Date() }).where(eq(communitySpend.id, id)).returning();
    return item;
  }

  async deleteCommunitySpend(id: number): Promise<void> {
    await db.delete(communitySpend).where(eq(communitySpend.id, id));
  }

  async getCommunitySpendByProgramme(programmeId: number): Promise<CommunitySpend[]> {
    return db.select().from(communitySpend).where(eq(communitySpend.programmeId, programmeId)).orderBy(desc(communitySpend.date));
  }

  async getGmailImportHistory(userId: string): Promise<GmailImportHistory[]> {
    return db.select().from(gmailImportHistory).where(eq(gmailImportHistory.userId, userId)).orderBy(desc(gmailImportHistory.createdAt));
  }

  async getGmailImportHistoryItem(id: number): Promise<GmailImportHistory | undefined> {
    const [item] = await db.select().from(gmailImportHistory).where(eq(gmailImportHistory.id, id));
    return item;
  }

  async createGmailImportHistory(data: InsertGmailImportHistory): Promise<GmailImportHistory> {
    const [item] = await db.insert(gmailImportHistory).values(data).returning();
    return item;
  }

  async updateGmailImportHistory(id: number, updates: Partial<GmailImportHistory>): Promise<GmailImportHistory> {
    const [item] = await db.update(gmailImportHistory).set(updates).where(eq(gmailImportHistory.id, id)).returning();
    return item;
  }

  async getGmailExclusions(userId: string): Promise<GmailExclusion[]> {
    return db.select().from(gmailExclusions).where(eq(gmailExclusions.userId, userId)).orderBy(desc(gmailExclusions.createdAt));
  }

  async createGmailExclusion(data: InsertGmailExclusion): Promise<GmailExclusion> {
    const [item] = await db.insert(gmailExclusions).values(data).returning();
    return item;
  }

  async deleteGmailExclusion(id: number): Promise<void> {
    await db.delete(gmailExclusions).where(eq(gmailExclusions.id, id));
  }

  async getGmailSyncSettings(userId: string): Promise<GmailSyncSettings | undefined> {
    const [settings] = await db.select().from(gmailSyncSettings).where(eq(gmailSyncSettings.userId, userId));
    return settings;
  }

  async createGmailSyncSettings(data: InsertGmailSyncSettings): Promise<GmailSyncSettings> {
    const [item] = await db.insert(gmailSyncSettings).values(data).returning();
    return item;
  }

  async updateGmailSyncSettings(userId: string, updates: Partial<InsertGmailSyncSettings>): Promise<GmailSyncSettings> {
    const [item] = await db.update(gmailSyncSettings).set({ ...updates, updatedAt: new Date() }).where(eq(gmailSyncSettings.userId, userId)).returning();
    return item;
  }

  async updateGmailSyncLastSync(userId: string, lastSyncAt: Date): Promise<void> {
    const existing = await this.getGmailSyncSettings(userId);
    if (existing) {
      await db.update(gmailSyncSettings).set({ lastSyncAt, updatedAt: new Date() }).where(eq(gmailSyncSettings.userId, userId));
    }
  }

  async getAllGmailSyncSettings(): Promise<GmailSyncSettings[]> {
    return db.select().from(gmailSyncSettings).where(eq(gmailSyncSettings.autoSyncEnabled, true));
  }

  async getGmailConnectedAccounts(userId: string): Promise<GmailConnectedAccount[]> {
    return db.select().from(gmailConnectedAccounts).where(eq(gmailConnectedAccounts.userId, userId)).orderBy(desc(gmailConnectedAccounts.createdAt));
  }

  async getGmailConnectedAccount(id: number): Promise<GmailConnectedAccount | undefined> {
    const [item] = await db.select().from(gmailConnectedAccounts).where(eq(gmailConnectedAccounts.id, id));
    return item;
  }

  async createGmailConnectedAccount(data: InsertGmailConnectedAccount): Promise<GmailConnectedAccount> {
    const [item] = await db.insert(gmailConnectedAccounts).values(data).returning();
    return item;
  }

  async updateGmailConnectedAccount(id: number, updates: Partial<InsertGmailConnectedAccount>): Promise<GmailConnectedAccount> {
    const [item] = await db.update(gmailConnectedAccounts).set({ ...updates, updatedAt: new Date() }).where(eq(gmailConnectedAccounts.id, id)).returning();
    return item;
  }

  async deleteGmailConnectedAccount(id: number): Promise<void> {
    await db.delete(gmailConnectedAccounts).where(eq(gmailConnectedAccounts.id, id));
  }

  async getGmailConnectedAccountByEmail(userId: string, email: string): Promise<GmailConnectedAccount | undefined> {
    const [item] = await db.select().from(gmailConnectedAccounts).where(and(eq(gmailConnectedAccounts.userId, userId), eq(gmailConnectedAccounts.email, email)));
    return item;
  }

  async getOrganisationProfile(userId: string): Promise<OrganisationProfile | undefined> {
    const [item] = await db.select().from(organisationProfile).where(eq(organisationProfile.userId, userId)).limit(1);
    return item;
  }

  async upsertOrganisationProfile(userId: string, data: Partial<InsertOrganisationProfile>): Promise<OrganisationProfile> {
    const existing = await this.getOrganisationProfile(userId);
    if (existing) {
      const [item] = await db.update(organisationProfile).set({ ...data, updatedAt: new Date() }).where(eq(organisationProfile.id, existing.id)).returning();
      return item;
    }
    const [item] = await db.insert(organisationProfile).values({ ...data, userId }).returning();
    return item;
  }

  async getFunders(userId: string): Promise<Funder[]> {
    return db.select().from(funders).where(eq(funders.userId, userId)).orderBy(desc(funders.createdAt));
  }

  async getFunder(id: number): Promise<Funder | undefined> {
    const [item] = await db.select().from(funders).where(eq(funders.id, id));
    return item;
  }

  async getFunderByTag(userId: string, funderTag: string): Promise<Funder | undefined> {
    const [item] = await db.select().from(funders).where(and(eq(funders.userId, userId), eq(funders.funderTag, funderTag)));
    return item;
  }

  async createFunder(data: InsertFunder): Promise<Funder> {
    const [item] = await db.insert(funders).values(data).returning();
    return item;
  }

  async updateFunder(id: number, updates: Partial<InsertFunder>): Promise<Funder> {
    const [item] = await db.update(funders).set(updates).where(eq(funders.id, id)).returning();
    return item;
  }

  async deleteFunder(id: number): Promise<void> {
    await db.delete(funderDocuments).where(eq(funderDocuments.funderId, id));
    await db.delete(funders).where(eq(funders.id, id));
  }

  async getFunderDocuments(funderId: number): Promise<FunderDocument[]> {
    return db.select().from(funderDocuments).where(eq(funderDocuments.funderId, funderId)).orderBy(desc(funderDocuments.createdAt));
  }

  async getFunderDocument(id: number): Promise<FunderDocument | undefined> {
    const [item] = await db.select().from(funderDocuments).where(eq(funderDocuments.id, id));
    return item;
  }

  async createFunderDocument(data: InsertFunderDocument): Promise<FunderDocument> {
    const [item] = await db.insert(funderDocuments).values(data).returning();
    return item;
  }

  async deleteFunderDocument(id: number): Promise<void> {
    await db.delete(funderDocuments).where(eq(funderDocuments.id, id));
  }

  // Mentoring Relationships
  async getMentoringRelationships(): Promise<MentoringRelationship[]> {
    return db.select().from(mentoringRelationships).orderBy(desc(mentoringRelationships.createdAt));
  }

  async getMentoringRelationship(id: number): Promise<MentoringRelationship | undefined> {
    const [item] = await db.select().from(mentoringRelationships).where(eq(mentoringRelationships.id, id));
    return item;
  }

  async getMentoringRelationshipsByContact(contactId: number): Promise<MentoringRelationship[]> {
    return db.select().from(mentoringRelationships).where(eq(mentoringRelationships.contactId, contactId)).orderBy(desc(mentoringRelationships.createdAt));
  }

  async createMentoringRelationship(data: InsertMentoringRelationship): Promise<MentoringRelationship> {
    const [item] = await db.insert(mentoringRelationships).values(data).returning();
    return item;
  }

  async updateMentoringRelationship(id: number, updates: Partial<InsertMentoringRelationship>): Promise<MentoringRelationship> {
    const [item] = await db.update(mentoringRelationships).set({ ...updates, updatedAt: new Date() }).where(eq(mentoringRelationships.id, id)).returning();
    return item;
  }

  async deleteMentoringRelationship(id: number): Promise<void> {
    await db.delete(mentoringRelationships).where(eq(mentoringRelationships.id, id));
  }

  // Mentoring Applications
  async getMentoringApplications(): Promise<MentoringApplication[]> {
    return db.select().from(mentoringApplications).orderBy(desc(mentoringApplications.createdAt));
  }

  async getMentoringApplication(id: number): Promise<MentoringApplication | undefined> {
    const [item] = await db.select().from(mentoringApplications).where(eq(mentoringApplications.id, id));
    return item;
  }

  async getMentoringApplicationsByContact(contactId: number): Promise<MentoringApplication[]> {
    return db.select().from(mentoringApplications).where(eq(mentoringApplications.contactId, contactId)).orderBy(desc(mentoringApplications.createdAt));
  }

  async createMentoringApplication(data: InsertMentoringApplication): Promise<MentoringApplication> {
    const [item] = await db.insert(mentoringApplications).values(data).returning();
    return item;
  }

  async updateMentoringApplication(id: number, updates: Partial<InsertMentoringApplication>): Promise<MentoringApplication> {
    const [item] = await db.update(mentoringApplications).set(updates).where(eq(mentoringApplications.id, id)).returning();
    return item;
  }

  async deleteMentoringApplication(id: number): Promise<void> {
    await db.delete(mentoringApplications).where(eq(mentoringApplications.id, id));
  }

  // Mentoring Onboarding Questions
  async getMentoringOnboardingQuestions(userId: string): Promise<MentoringOnboardingQuestion[]> {
    return db.select().from(mentoringOnboardingQuestions).where(eq(mentoringOnboardingQuestions.userId, userId)).orderBy(mentoringOnboardingQuestions.sortOrder);
  }

  async getMentoringOnboardingQuestion(id: number): Promise<MentoringOnboardingQuestion | undefined> {
    const [item] = await db.select().from(mentoringOnboardingQuestions).where(eq(mentoringOnboardingQuestions.id, id));
    return item;
  }

  async createMentoringOnboardingQuestion(data: InsertMentoringOnboardingQuestion): Promise<MentoringOnboardingQuestion> {
    const [item] = await db.insert(mentoringOnboardingQuestions).values(data).returning();
    return item;
  }

  async updateMentoringOnboardingQuestion(id: number, updates: Partial<InsertMentoringOnboardingQuestion>): Promise<MentoringOnboardingQuestion> {
    const [item] = await db.update(mentoringOnboardingQuestions).set(updates).where(eq(mentoringOnboardingQuestions.id, id)).returning();
    return item;
  }

  async deleteMentoringOnboardingQuestion(id: number): Promise<void> {
    await db.delete(mentoringOnboardingQuestions).where(eq(mentoringOnboardingQuestions.id, id));
  }

  // Projects
  async getProjects(userId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.createdBy, userId)).orderBy(desc(projects.updatedAt));
  }

  async getProject(id: number): Promise<Project | undefined> {
    const [item] = await db.select().from(projects).where(eq(projects.id, id));
    return item;
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [item] = await db.insert(projects).values(data).returning();
    return item;
  }

  async updateProject(id: number, updates: Partial<InsertProject>): Promise<Project> {
    const [item] = await db.update(projects).set({ ...updates, updatedAt: new Date() }).where(eq(projects.id, id)).returning();
    return item;
  }

  async deleteProject(id: number): Promise<void> {
    await db.delete(projectTasks).where(eq(projectTasks.projectId, id));
    await db.delete(projectUpdates).where(eq(projectUpdates.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  }

  async getProjectUpdates(projectId: number): Promise<ProjectUpdate[]> {
    return db.select().from(projectUpdates).where(eq(projectUpdates.projectId, projectId)).orderBy(desc(projectUpdates.createdAt));
  }

  async createProjectUpdate(data: InsertProjectUpdate): Promise<ProjectUpdate> {
    const [item] = await db.insert(projectUpdates).values(data).returning();
    return item;
  }

  async getProjectTasks(projectId: number): Promise<ProjectTask[]> {
    return db.select().from(projectTasks).where(eq(projectTasks.projectId, projectId)).orderBy(projectTasks.sortOrder, projectTasks.createdAt);
  }

  async getAllProjectTasks(userId: string): Promise<ProjectTask[]> {
    const userProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.createdBy, userId));
    if (userProjects.length === 0) return [];
    const projectIds = userProjects.map(p => p.id);
    return db.select().from(projectTasks).where(sql`${projectTasks.projectId} = ANY(${projectIds})`);
  }

  async getProjectTask(id: number): Promise<ProjectTask | undefined> {
    const [item] = await db.select().from(projectTasks).where(eq(projectTasks.id, id));
    return item;
  }

  async createProjectTask(data: InsertProjectTask): Promise<ProjectTask> {
    const [item] = await db.insert(projectTasks).values(data).returning();
    return item;
  }

  async updateProjectTask(id: number, updates: Partial<InsertProjectTask>): Promise<ProjectTask> {
    const [item] = await db.update(projectTasks).set({ ...updates, updatedAt: new Date() }).where(eq(projectTasks.id, id)).returning();
    return item;
  }

  async deleteProjectTask(id: number): Promise<void> {
    await db.delete(projectTasks).where(eq(projectTasks.id, id));
  }

  // Monthly Snapshots
  async getMonthlySnapshots(userId: string): Promise<MonthlySnapshot[]> {
    return db.select().from(monthlySnapshots).where(eq(monthlySnapshots.userId, userId)).orderBy(desc(monthlySnapshots.month));
  }

  async getMonthlySnapshot(id: number): Promise<MonthlySnapshot | undefined> {
    const [item] = await db.select().from(monthlySnapshots).where(eq(monthlySnapshots.id, id));
    return item;
  }

  async upsertMonthlySnapshot(userId: string, month: Date, data: Partial<InsertMonthlySnapshot>): Promise<MonthlySnapshot> {
    const existing = await db.select().from(monthlySnapshots).where(
      and(eq(monthlySnapshots.userId, userId), eq(monthlySnapshots.month, month))
    );
    if (existing.length > 0) {
      const [updated] = await db.update(monthlySnapshots)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(monthlySnapshots.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(monthlySnapshots)
      .values({ userId, month, ...data })
      .returning();
    return created;
  }

  async deleteMonthlySnapshot(id: number): Promise<void> {
    await db.delete(monthlySnapshots).where(eq(monthlySnapshots.id, id));
  }

  // Report Highlights
  async getReportHighlights(userId: string): Promise<ReportHighlight[]> {
    return db.select().from(reportHighlights).where(eq(reportHighlights.userId, userId)).orderBy(desc(reportHighlights.createdAt));
  }

  async getReportHighlight(id: number): Promise<ReportHighlight | undefined> {
    const [item] = await db.select().from(reportHighlights).where(eq(reportHighlights.id, id));
    return item;
  }

  async createReportHighlight(data: InsertReportHighlight): Promise<ReportHighlight> {
    const [created] = await db.insert(reportHighlights).values(data).returning();
    return created;
  }

  async deleteReportHighlight(id: number): Promise<void> {
    await db.delete(reportHighlights).where(eq(reportHighlights.id, id));
  }

  // Foot Traffic Touchpoints
  async getFootTrafficTouchpoints(snapshotId: number): Promise<any[]> {
    const rows = await db.select({
      id: footTrafficTouchpoints.id,
      userId: footTrafficTouchpoints.userId,
      snapshotId: footTrafficTouchpoints.snapshotId,
      contactId: footTrafficTouchpoints.contactId,
      groupId: footTrafficTouchpoints.groupId,
      description: footTrafficTouchpoints.description,
      createdAt: footTrafficTouchpoints.createdAt,
      contactName: contacts.name,
      groupName: groups.name,
    })
    .from(footTrafficTouchpoints)
    .leftJoin(contacts, eq(footTrafficTouchpoints.contactId, contacts.id))
    .leftJoin(groups, eq(footTrafficTouchpoints.groupId, groups.id))
    .where(eq(footTrafficTouchpoints.snapshotId, snapshotId))
    .orderBy(desc(footTrafficTouchpoints.createdAt));
    return rows;
  }

  async createFootTrafficTouchpoint(data: InsertFootTrafficTouchpoint): Promise<FootTrafficTouchpoint> {
    const [created] = await db.insert(footTrafficTouchpoints).values(data).returning();
    return created;
  }

  async deleteFootTrafficTouchpoint(id: number): Promise<void> {
    await db.delete(footTrafficTouchpoints).where(eq(footTrafficTouchpoints.id, id));
  }

  // Catch Up List
  async getCatchUpList(userId: string): Promise<any[]> {
    return db.select({
      id: catchUpList.id,
      userId: catchUpList.userId,
      contactId: catchUpList.contactId,
      note: catchUpList.note,
      priority: catchUpList.priority,
      createdAt: catchUpList.createdAt,
      dismissedAt: catchUpList.dismissedAt,
      contactName: contacts.name,
      contactRole: contacts.role,
      contactStage: contacts.stage,
      contactConnectionStrength: contacts.connectionStrength,
      contactIsInnovator: contacts.isInnovator,
      contactIsCommunityMember: contacts.isCommunityMember,
      contactIsVip: contacts.isVip,
      contactVipReason: contacts.vipReason,
      contactLastActiveDate: contacts.lastActiveDate,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
    })
    .from(catchUpList)
    .leftJoin(contacts, eq(catchUpList.contactId, contacts.id))
    .where(and(eq(catchUpList.userId, userId), sql`${catchUpList.dismissedAt} IS NULL`))
    .orderBy(desc(catchUpList.createdAt));
  }

  async getCatchUpListHistory(userId: string): Promise<any[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return db.select({
      id: catchUpList.id,
      userId: catchUpList.userId,
      contactId: catchUpList.contactId,
      note: catchUpList.note,
      priority: catchUpList.priority,
      createdAt: catchUpList.createdAt,
      dismissedAt: catchUpList.dismissedAt,
      contactName: contacts.name,
      contactRole: contacts.role,
      contactStage: contacts.stage,
      contactIsVip: contacts.isVip,
      contactVipReason: contacts.vipReason,
      contactLastActiveDate: contacts.lastActiveDate,
    })
    .from(catchUpList)
    .leftJoin(contacts, eq(catchUpList.contactId, contacts.id))
    .where(and(
      eq(catchUpList.userId, userId),
      sql`${catchUpList.dismissedAt} IS NOT NULL`,
      gte(catchUpList.dismissedAt, thirtyDaysAgo),
    ))
    .orderBy(desc(catchUpList.dismissedAt));
  }

  async getLastCaughtUpDates(userId: string): Promise<{ contactId: number; lastDismissedAt: string }[]> {
    const result = await db.select({
      contactId: catchUpList.contactId,
      lastDismissedAt: sql<string>`max(${catchUpList.dismissedAt})`,
    })
    .from(catchUpList)
    .where(and(
      eq(catchUpList.userId, userId),
      sql`${catchUpList.dismissedAt} IS NOT NULL`,
    ))
    .groupBy(catchUpList.contactId);
    return result as { contactId: number; lastDismissedAt: string }[];
  }

  async addToCatchUpList(data: InsertCatchUpItem): Promise<CatchUpItem> {
    const existing = await db.select().from(catchUpList).where(and(
      eq(catchUpList.userId, data.userId),
      eq(catchUpList.contactId, data.contactId),
      sql`${catchUpList.dismissedAt} IS NULL`,
    ));
    if (existing.length > 0) {
      const [updated] = await db.update(catchUpList)
        .set({ note: data.note, priority: data.priority })
        .where(eq(catchUpList.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(catchUpList).values(data).returning();
    return created;
  }

  async updateCatchUpItem(id: number, updates: Partial<InsertCatchUpItem>): Promise<CatchUpItem> {
    const [updated] = await db.update(catchUpList).set(updates).where(eq(catchUpList.id, id)).returning();
    return updated;
  }

  async dismissCatchUpItem(id: number): Promise<CatchUpItem> {
    const [updated] = await db.update(catchUpList).set({ dismissedAt: new Date() }).where(eq(catchUpList.id, id)).returning();
    return updated;
  }

  async removeCatchUpItem(id: number): Promise<void> {
    await db.delete(catchUpList).where(eq(catchUpList.id, id));
  }

  // Programme Registrations
  async createProgrammeRegistration(data: InsertProgrammeRegistration): Promise<ProgrammeRegistration> {
    const [registration] = await db.insert(programmeRegistrations).values(data).returning();
    return registration;
  }

  async getProgrammeRegistrations(programmeId: number): Promise<ProgrammeRegistration[]> {
    return db.select().from(programmeRegistrations)
      .where(eq(programmeRegistrations.programmeId, programmeId))
      .orderBy(desc(programmeRegistrations.registeredAt));
  }

  async getProgrammeRegistration(id: number): Promise<ProgrammeRegistration | undefined> {
    const [registration] = await db.select().from(programmeRegistrations).where(eq(programmeRegistrations.id, id));
    return registration;
  }

  async updateProgrammeRegistration(id: number, updates: Partial<InsertProgrammeRegistration>): Promise<ProgrammeRegistration> {
    const [updated] = await db.update(programmeRegistrations).set(updates).where(eq(programmeRegistrations.id, id)).returning();
    return updated;
  }

  async deleteProgrammeRegistration(id: number): Promise<void> {
    await db.delete(programmeRegistrations).where(eq(programmeRegistrations.id, id));
  }

  async getProgrammeRegistrationsByContact(contactId: number): Promise<ProgrammeRegistration[]> {
    return db.select().from(programmeRegistrations)
      .where(eq(programmeRegistrations.contactId, contactId))
      .orderBy(desc(programmeRegistrations.registeredAt));
  }

  async getProgrammeRegistrationCount(programmeId: number): Promise<number> {
    const [result] = await db.select({ count: count() }).from(programmeRegistrations)
      .where(and(
        eq(programmeRegistrations.programmeId, programmeId),
        eq(programmeRegistrations.status, "registered")
      ));
    return result?.count || 0;
  }

  async getProgrammeBySlug(slug: string): Promise<Programme | undefined> {
    const [programme] = await db.select().from(programmes).where(eq(programmes.slug, slug));
    return programme;
  }

  async getBookableResources(userId: string): Promise<BookableResource[]> {
    return db.select().from(bookableResources)
      .where(eq(bookableResources.userId, userId))
      .orderBy(bookableResources.name);
  }

  async getBookableResourcesByCategory(userId: string, category: string): Promise<BookableResource[]> {
    return db.select().from(bookableResources)
      .where(and(eq(bookableResources.userId, userId), eq(bookableResources.category, category)))
      .orderBy(bookableResources.name);
  }

  async getBookableResource(id: number): Promise<BookableResource | undefined> {
    const [resource] = await db.select().from(bookableResources).where(eq(bookableResources.id, id));
    return resource;
  }

  async createBookableResource(data: InsertBookableResource): Promise<BookableResource> {
    const [resource] = await db.insert(bookableResources).values(data).returning();
    return resource;
  }

  async updateBookableResource(id: number, updates: Partial<InsertBookableResource>): Promise<BookableResource> {
    const [resource] = await db.update(bookableResources).set(updates).where(eq(bookableResources.id, id)).returning();
    return resource;
  }

  async deleteBookableResource(id: number): Promise<void> {
    await db.delete(bookableResources).where(eq(bookableResources.id, id));
  }

  async getDeskBookings(userId: string): Promise<DeskBooking[]> {
    return db.select().from(deskBookings)
      .where(eq(deskBookings.userId, userId))
      .orderBy(desc(deskBookings.date));
  }

  async getDeskBookingsByResource(resourceId: number): Promise<DeskBooking[]> {
    return db.select().from(deskBookings)
      .where(eq(deskBookings.resourceId, resourceId))
      .orderBy(desc(deskBookings.date));
  }

  async getDeskBookingsByBooker(regularBookerId: number): Promise<DeskBooking[]> {
    return db.select().from(deskBookings)
      .where(eq(deskBookings.regularBookerId, regularBookerId))
      .orderBy(desc(deskBookings.date));
  }

  async getDeskBookingsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<DeskBooking[]> {
    return db.select().from(deskBookings)
      .where(and(
        eq(deskBookings.userId, userId),
        gte(deskBookings.date, startDate),
        lte(deskBookings.date, endDate),
      ))
      .orderBy(deskBookings.date);
  }

  async getDeskBooking(id: number): Promise<DeskBooking | undefined> {
    const [booking] = await db.select().from(deskBookings).where(eq(deskBookings.id, id));
    return booking;
  }

  async createDeskBooking(data: InsertDeskBooking): Promise<DeskBooking> {
    const [booking] = await db.insert(deskBookings).values(data).returning();
    return booking;
  }

  async createDeskBookingWithConflictCheck(data: InsertDeskBooking): Promise<DeskBooking> {
    return await db.transaction(async (tx) => {
      const bookingDate = new Date(data.date);
      const dayStart = new Date(bookingDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(bookingDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dateKey = dayStart.toISOString().slice(0, 10).replace(/-/g, "");
      const lockKey = data.resourceId * 100000000 + parseInt(dateKey);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      const existing = await tx.select().from(deskBookings).where(
        and(
          eq(deskBookings.resourceId, data.resourceId),
          gte(deskBookings.date, dayStart),
          lte(deskBookings.date, dayEnd),
        )
      );

      const hasConflict = existing.some(b => {
        if (b.status === "cancelled") return false;
        if (!data.startTime || !data.endTime || !b.startTime || !b.endTime) return true;
        const a0 = parseInt(data.startTime.split(":")[0]) * 60 + parseInt(data.startTime.split(":")[1] || "0");
        const a1 = parseInt(data.endTime.split(":")[0]) * 60 + parseInt(data.endTime.split(":")[1] || "0");
        const b0 = parseInt(b.startTime.split(":")[0]) * 60 + parseInt(b.startTime.split(":")[1] || "0");
        const b1 = parseInt(b.endTime.split(":")[0]) * 60 + parseInt(b.endTime.split(":")[1] || "0");
        return a0 < b1 && b0 < a1;
      });

      if (hasConflict) {
        throw new Error("CONFLICT");
      }

      const [booking] = await tx.insert(deskBookings).values(data).returning();
      return booking;
    });
  }

  async updateDeskBooking(id: number, updates: Partial<InsertDeskBooking>): Promise<DeskBooking> {
    const [booking] = await db.update(deskBookings).set(updates).where(eq(deskBookings.id, id)).returning();
    return booking;
  }

  async deleteDeskBooking(id: number): Promise<void> {
    await db.delete(deskBookings).where(eq(deskBookings.id, id));
  }

  async getGearBookings(userId: string): Promise<GearBooking[]> {
    return db.select().from(gearBookings)
      .where(eq(gearBookings.userId, userId))
      .orderBy(desc(gearBookings.date));
  }

  async getGearBookingsByResource(resourceId: number): Promise<GearBooking[]> {
    return db.select().from(gearBookings)
      .where(eq(gearBookings.resourceId, resourceId))
      .orderBy(desc(gearBookings.date));
  }

  async getGearBookingsByBooker(regularBookerId: number): Promise<GearBooking[]> {
    return db.select().from(gearBookings)
      .where(eq(gearBookings.regularBookerId, regularBookerId))
      .orderBy(desc(gearBookings.date));
  }

  async getGearBookingsByDate(userId: string, date: Date): Promise<GearBooking[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    return db.select().from(gearBookings)
      .where(and(
        eq(gearBookings.userId, userId),
        gte(gearBookings.date, startOfDay),
        lte(gearBookings.date, endOfDay),
      ))
      .orderBy(gearBookings.date);
  }

  async getGearBooking(id: number): Promise<GearBooking | undefined> {
    const [booking] = await db.select().from(gearBookings).where(eq(gearBookings.id, id));
    return booking;
  }

  async createGearBooking(data: InsertGearBooking): Promise<GearBooking> {
    const [booking] = await db.insert(gearBookings).values(data).returning();
    return booking;
  }

  async createGearBookingWithConflictCheck(data: InsertGearBooking): Promise<GearBooking> {
    return await db.transaction(async (tx) => {
      const bookingDate = new Date(data.date);
      const dayStart = new Date(bookingDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(bookingDate);
      dayEnd.setHours(23, 59, 59, 999);

      const dateKey = dayStart.toISOString().slice(0, 10).replace(/-/g, "");
      const lockKey = (data.resourceId + 500000) * 100000000 + parseInt(dateKey);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      const existing = await tx.select().from(gearBookings).where(
        and(
          eq(gearBookings.resourceId, data.resourceId),
          gte(gearBookings.date, dayStart),
          lte(gearBookings.date, dayEnd),
        )
      );

      const alreadyBooked = existing.some(b => b.status === "booked");
      if (alreadyBooked) {
        throw new Error("CONFLICT");
      }

      const [booking] = await tx.insert(gearBookings).values(data).returning();
      return booking;
    });
  }

  async updateGearBooking(id: number, updates: Partial<InsertGearBooking>): Promise<GearBooking> {
    const [booking] = await db.update(gearBookings).set(updates).where(eq(gearBookings.id, id)).returning();
    return booking;
  }

  async deleteGearBooking(id: number): Promise<void> {
    await db.delete(gearBookings).where(eq(gearBookings.id, id));
  }

  async markGearReturned(id: number): Promise<GearBooking> {
    const [booking] = await db.update(gearBookings)
      .set({ status: "returned", returnedAt: new Date() })
      .where(eq(gearBookings.id, id))
      .returning();
    return booking;
  }

  async getLateGearReturns(userId: string): Promise<GearBooking[]> {
    return db.select().from(gearBookings)
      .where(and(
        eq(gearBookings.userId, userId),
        eq(gearBookings.status, "late"),
      ))
      .orderBy(desc(gearBookings.date));
  }

  async createMetricSnapshot(data: InsertMetricSnapshot): Promise<MetricSnapshot> {
    const [snapshot] = await db.insert(metricSnapshots).values(data).returning();
    return snapshot;
  }

  async getMetricSnapshots(contactId: number): Promise<MetricSnapshot[]> {
    return db.select().from(metricSnapshots)
      .where(eq(metricSnapshots.contactId, contactId))
      .orderBy(desc(metricSnapshots.createdAt));
  }

  async getMetricSnapshotsByContacts(contactIds: number[], startDate?: Date, endDate?: Date): Promise<MetricSnapshot[]> {
    if (contactIds.length === 0) return [];
    const conditions = [inArray(metricSnapshots.contactId, contactIds)];
    if (startDate) conditions.push(gte(metricSnapshots.createdAt, startDate));
    if (endDate) conditions.push(lte(metricSnapshots.createdAt, endDate));
    return db.select().from(metricSnapshots)
      .where(and(...conditions))
      .orderBy(metricSnapshots.createdAt);
  }

  async getBookingChangeRequests(userId: string): Promise<BookingChangeRequest[]> {
    const userBookingIds = await db.select({ id: bookings.id }).from(bookings).where(eq(bookings.userId, userId));
    if (userBookingIds.length === 0) return [];
    return db.select().from(bookingChangeRequests)
      .where(inArray(bookingChangeRequests.bookingId, userBookingIds.map(b => b.id)))
      .orderBy(desc(bookingChangeRequests.createdAt));
  }

  async getBookingChangeRequest(id: number): Promise<BookingChangeRequest | undefined> {
    const [request] = await db.select().from(bookingChangeRequests).where(eq(bookingChangeRequests.id, id));
    return request;
  }

  async getBookingChangeRequestsByBooking(bookingId: number): Promise<BookingChangeRequest[]> {
    return db.select().from(bookingChangeRequests)
      .where(eq(bookingChangeRequests.bookingId, bookingId))
      .orderBy(desc(bookingChangeRequests.createdAt));
  }

  async createBookingChangeRequest(data: InsertBookingChangeRequest): Promise<BookingChangeRequest> {
    const [request] = await db.insert(bookingChangeRequests).values(data).returning();
    return request;
  }

  async updateBookingChangeRequest(id: number, updates: Partial<InsertBookingChangeRequest>): Promise<BookingChangeRequest> {
    const [request] = await db.update(bookingChangeRequests).set(updates).where(eq(bookingChangeRequests.id, id)).returning();
    return request;
  }
}

export const storage = new DatabaseStorage();
