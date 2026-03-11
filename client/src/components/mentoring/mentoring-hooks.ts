import { useQuery } from "@tanstack/react-query";
import {
  Sprout,
  TreePine,
  Sun,
  Pause,
} from "lucide-react";
import type { MentorProfile, MentoringRelationship, MentoringApplication } from "@shared/schema";

export const JOURNEY_STAGE_CONFIG: Record<string, { label: string; desc: string; color: string; bgColor: string; icon: any }> = {
  kakano: { label: "Kakano", desc: "Seed / Foundation", color: "text-amber-700 dark:text-amber-400", bgColor: "bg-amber-500/10 border-amber-200 dark:border-amber-800", icon: Sprout },
  tipu: { label: "Tipu", desc: "Actively Growing", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-500/10 border-green-200 dark:border-green-800", icon: TreePine },
  ora: { label: "Ora", desc: "Thriving / Sustained", color: "text-sky-700 dark:text-sky-400", bgColor: "bg-sky-500/10 border-sky-200 dark:border-sky-800", icon: Sun },
  inactive: { label: "Inactive", desc: "Paused / Stepped back", color: "text-muted-foreground", bgColor: "bg-muted border-border", icon: Pause },
};

export const RELATIONSHIP_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  application: { label: "Application", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400" },
  active: { label: "Active", color: "bg-green-500/10 text-green-700 dark:text-green-400" },
  on_hold: { label: "On Hold", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  graduated: { label: "Graduated", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
  ended: { label: "Ended", color: "bg-muted text-muted-foreground" },
};

export const VENTURE_TYPE_LABELS: Record<string, string> = {
  commercial_business: "Commercial Business",
  social_enterprise: "Social Enterprise",
  creative_movement: "Creative Movement",
  community_initiative: "Community Initiative",
  exploring: "Exploring",
  ecosystem_partner: "Ecosystem Partner",
};

export const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  fortnightly: 14,
  monthly: 30,
};

export const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  ad_hoc: "Ad-hoc",
};

export type EnrichedRelationship = MentoringRelationship & {
  contactName: string;
  contactEmail?: string;
  stage?: string;
  ventureType?: string;
  whatTheyAreBuilding?: string;
  supportType?: string[];
  completedSessionCount: number;
  upcomingSessionCount: number;
  totalSessionCount: number;
  lastSessionDate: string | null;
  lastSessionFocus: string | null;
  recentSessionIds: number[];
  ventureDescription?: string | null;
  whatNeedHelpWith?: string | null;
  onboardingAnswers?: Record<string, string> | null;
  applicationNotes?: string | null;
};

export type DebriefSummary = {
  meetingId: number;
  mindsetScore?: number;
  skillScore?: number;
  confidenceScore?: number;
  keyInsights: string[];
  summary?: string;
};

export function getMentorBookingId(profile: MentorProfile): string {
  return profile.mentorUserId || `mentor-${profile.id}`;
}

export function useMentorProfiles() {
  return useQuery<MentorProfile[]>({ queryKey: ["/api/mentor-profiles"] });
}

export function useEnrichedRelationships() {
  return useQuery<EnrichedRelationship[]>({ queryKey: ["/api/mentoring-relationships/enriched"] });
}

export function useDebriefSummaries() {
  return useQuery<Record<number, DebriefSummary>>({ queryKey: ["/api/meetings/debrief-summaries"] });
}

export function useMentoringApplications() {
  return useQuery<MentoringApplication[]>({ queryKey: ["/api/mentoring-applications"] });
}

export function isOverdue(relationship: EnrichedRelationship): boolean {
  if (!relationship.lastSessionDate || !relationship.sessionFrequency) return false;
  if (relationship.status !== "active") return false;
  if (relationship.sessionFrequency === "ad_hoc") return false;
  const daysSince = Math.floor((Date.now() - new Date(relationship.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24));
  const threshold = FREQUENCY_DAYS[relationship.sessionFrequency] || 30;
  return daysSince > threshold * 1.25;
}
