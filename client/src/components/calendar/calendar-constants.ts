import type { GoogleCalendarEvent } from "@/types/google-calendar";
import type { Booking } from "@shared/schema";

export interface AppEvent {
  id: number;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  location: string | null;
  description: string | null;
  googleCalendarEventId: string | null;
  tags: string[] | null;
  attendeeCount: number | null;
  linkedProgrammeId: number | null;
  linkedBookingId: number | null;
  source: string | null;
  requiresDebrief: boolean | null;
  eventStatus: string | null;
  debriefSkippedReason: string | null;
  spaceUseType: string | null;
}

export type CombinedEvent = {
  date: Date;
  type: "gcal" | "app" | "booking";
  gcal?: GoogleCalendarEvent;
  app?: AppEvent;
  booking?: Booking;
  isPast: boolean;
  isDismissed?: boolean;
};

export type DebriefInfo = { debriefId: number; status: string } | null;

export const EVENT_TYPES = ["Team Meeting", "External Meeting", "Mentoring Session", "Programme", "Venue Hire", "Public Holiday"] as const;

export const EVENT_TYPE_DOT_COLORS: Record<string, string> = {
  "Team Meeting": "bg-gray-400",
  "External Meeting": "bg-teal-400",
  "Mentoring Session": "bg-blue-400",
  "Programme": "bg-indigo-400",
  "Venue Hire": "bg-amber-400",
  "Public Holiday": "bg-red-400",
};

export const EVENT_TYPE_BADGE_COLORS: Record<string, string> = {
  "Team Meeting": "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  "External Meeting": "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  "Mentoring Session": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Programme": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  "Venue Hire": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Public Holiday": "bg-red-500/10 text-red-700 dark:text-red-300",
};

export const EVENT_TYPE_CARD_TINTS: Record<string, string> = {
  "Team Meeting": "border-gray-500/20 bg-gray-500/5 dark:bg-gray-500/5",
  "External Meeting": "border-teal-500/20 bg-teal-500/5 dark:bg-teal-500/5",
  "Mentoring Session": "border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/5",
  "Programme": "border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/5",
  "Venue Hire": "border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/5",
  "Public Holiday": "border-red-500/30 bg-red-500/10 dark:bg-red-500/10",
};

export const PROG_CLASSIFICATION_COLORS: Record<string, string> = {
  "Community Workshop": "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "Creative Workshop": "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  "Youth Workshop": "bg-pink-500/15 text-pink-700 dark:text-pink-300",
  "Talks": "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "Networking": "bg-green-500/15 text-green-700 dark:text-green-300",
};

export const PROG_STATUS_COLORS: Record<string, string> = {
  planned: "bg-gray-50/50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800",
  active: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  completed: "bg-green-50/30 dark:bg-green-900/10 border-green-100 dark:border-green-900/20 opacity-70",
  cancelled: "bg-gray-100/30 dark:bg-gray-900/10 border-gray-100 dark:border-gray-900/20 opacity-70",
};

export const BOOKING_BADGE_COLORS: Record<string, string> = {
  "Workshop": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Community Event": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "Private Hire": "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "Rehearsal": "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "Meeting": "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  "Pop-up": "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  "Other": "bg-gray-500/10 text-gray-700 dark:text-gray-300",
  "Community Workshop": "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  "Creative Workshop": "bg-purple-500/10 text-purple-700 dark:text-purple-300",
  "Youth Workshop": "bg-pink-500/10 text-pink-700 dark:text-pink-300",
  "Talks": "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "Networking": "bg-green-500/10 text-green-700 dark:text-green-300",
};

export const BOOKING_CARD_COLORS: Record<string, string> = {
  "Workshop": "border-blue-500/30 bg-blue-500/5",
  "Community Event": "border-green-500/30 bg-green-500/5",
  "Private Hire": "border-orange-500/30 bg-orange-500/5",
  "Rehearsal": "border-purple-500/30 bg-purple-500/5",
  "Meeting": "border-slate-500/30 bg-slate-500/5",
  "Pop-up": "border-pink-500/30 bg-pink-500/5",
  "Other": "border-gray-500/30 bg-gray-500/5",
};

export const BOOKING_DOT_COLORS: Record<string, string> = {
  "Workshop": "bg-blue-400",
  "Community Event": "bg-emerald-400",
  "Private Hire": "bg-orange-400",
  "Rehearsal": "bg-violet-400",
  "Meeting": "bg-cyan-400",
  "Pop-up": "bg-pink-400",
  "Other": "bg-gray-400",
};

export const SPACE_STATUS_COLORS: Record<string, string> = {
  enquiry: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  confirmed: "bg-green-500/15 text-green-700 dark:text-green-300",
  completed: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-300 line-through",
  planned: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  active: "bg-green-500/15 text-green-700 dark:text-green-300",
};

export const ACTIVITY_TYPES = ["Hub Activity", "Drop-in", "Meeting", "Community Event", "Venue Hire", "Other"] as const;

const GCAL_TYPE_KEYWORDS: { type: string; keywords: string[] }[] = [
  { type: "Mentoring Session", keywords: ["mentor", "mentoring", "mentee", "coaching", "1:1", "one on one", "1-on-1"] },
  { type: "Programme", keywords: ["programme", "program", "community workshop", "creative workshop", "youth workshop", "talks", "activation"] },
];

const PERSONAL_EVENT_KEYWORDS = [
  "haircut", "barber", "dentist", "doctor", "gym", "workout", "physio",
  "optometrist", "vet", "grooming", "massage", "therapy", "appointment",
  "pickup", "drop off", "school run", "flight", "personal",
];

export function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatTime(dateStr: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Pacific/Auckland" });
}

export function cleanDescription(desc: string | null | undefined): string {
  if (!desc) return "";
  return desc
    .replace(/_{3,}/g, "")
    .replace(/Microsoft Teams meeting[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/Join:?\s*https:\/\/teams\.microsoft\.com\S*/gi, "")
    .replace(/Meeting ID:\s*[\d\s]+/gi, "")
    .replace(/Passcode:\s*\S+/gi, "")
    .replace(/Need help\?[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/For organisers:[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/System reference[\s\S]*?(?=\n\n|$)/gi, "")
    .replace(/https:\/\/teams\.microsoft\.com\S*/gi, "")
    .replace(/https:\/\/\S*zoom\S*/gi, "[Zoom link]")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isPersonalEvent(title: string, description?: string): boolean {
  const text = `${title} ${description || ""}`.toLowerCase();
  return PERSONAL_EVENT_KEYWORDS.some(kw => text.includes(kw));
}

export function classifyGcalEvent(gcal: GoogleCalendarEvent): string {
  if (gcal.suggestedType) return gcal.suggestedType;
  const text = `${gcal.summary || ""} ${gcal.description || ""}`.toLowerCase();
  for (const { type, keywords } of GCAL_TYPE_KEYWORDS) {
    if (keywords.some(kw => text.includes(kw))) return type;
  }
  return "Meeting";
}

export function getEventType(e: CombinedEvent): string {
  if (e.type === "booking" && e.booking) return "Venue Hire";
  if (e.type === "app" && e.app) return e.app.type;
  if (e.type === "gcal" && e.gcal) return classifyGcalEvent(e.gcal);
  return "Meeting";
}

export function getEventDotColor(e: CombinedEvent) {
  const eventType = getEventType(e);
  return EVENT_TYPE_DOT_COLORS[eventType] || "bg-gray-400";
}

export type SpaceOccupancyItem = {
  kind: "booking" | "programme";
  id: number;
  title: string;
  bookerName: string | null;
  date: Date;
  startDate: Date | null;
  endDate: Date | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  venueId: number | null;
  status: string;
  classification: string;
};

export const NOT_PERSONAL_REASON = "__not_personal__";
export const PROGRAMME_MONTHLY_TARGET = 2;
