export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  attendees: { email: string; displayName: string; responseStatus: string; organizer?: boolean }[];
  htmlLink: string;
  status: string;
  calendarId?: string;
  calendarLabel?: string | null;
  suggestedType?: string | null;
  matchedContacts?: { contactId: number; contactName: string; email: string }[];
}

export interface GoogleCalendarInfo {
  id: string;
  summary: string;
  description: string;
  backgroundColor: string;
  foregroundColor: string;
  primary: boolean;
  accessRole: string;
}
