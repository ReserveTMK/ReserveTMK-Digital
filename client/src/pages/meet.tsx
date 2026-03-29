import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useContacts, useCreateContact } from "@/hooks/use-contacts";
import { useCreateMeeting } from "@/hooks/use-meetings";
import { useVenues } from "@/hooks/use-bookings";
import { apiRequest } from "@/lib/queryClient";
import {
  ChevronLeft,
  Search,
  UserPlus,
  CalendarPlus,
  Clock,
  MapPin,
  Check,
  Send,
  Building2,
  Video,
  Coffee,
  Briefcase,
  Loader2,
} from "lucide-react";

type Step = "who" | "what" | "where" | "confirm" | "done";

interface MeetingType {
  id: number;
  name: string;
  duration: number;
  color: string;
  category: string;
  focus: string | null;
  isActive?: boolean;
}

const LOCATION_PRESETS = [
  { id: "hub", label: "Hub", icon: Building2 },
  { id: "zoom", label: "Zoom", icon: Video },
  { id: "cafe", label: "Café", icon: Coffee },
  { id: "their-office", label: "Their Office", icon: Briefcase },
];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const cells: { date: string; day: number; inMonth: boolean }[] = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    cells.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      date: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      inMonth: true,
    });
  }
  while (cells.length % 7 !== 0) {
    const d = cells.length - daysInMonth - startDay + 1;
    const m = month + 2 > 12 ? 1 : month + 2;
    const y = month + 2 > 12 ? year + 1 : year;
    cells.push({ date: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, day: d, inMonth: false });
  }
  return cells;
}

const TIME_OPTIONS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30",
  "17:00",
];

function formatTime(t: string) {
  const [h, m] = t.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "pm" : "am";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m}${ampm}`;
}

function formatDateNice(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
}

export default function MeetPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>("who");

  // Step 1: Who
  const { data: contacts } = useContacts();
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAddName, setQuickAddName] = useState("");
  const [quickAddEmail, setQuickAddEmail] = useState("");
  const createContactMutation = useCreateContact();

  // Step 2: What & When
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [selectedType, setSelectedType] = useState<MeetingType | null>(null);
  const [notes, setNotes] = useState("");
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("10:00");
  const [duration, setDuration] = useState(30);

  // Step 3: Where
  const { data: venues } = useVenues();
  const [locationPreset, setLocationPreset] = useState("");
  const [selectedVenueId, setSelectedVenueId] = useState<number | null>(null);
  const [customLocation, setCustomLocation] = useState("");

  // Step 4: Confirm
  const [sendInvite, setSendInvite] = useState(true);
  const createMeetingMutation = useCreateMeeting();

  // Load meeting types
  useEffect(() => {
    fetch("/api/meeting-types", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setMeetingTypes(data);
      })
      .catch(() => {});
  }, []);

  const filteredContacts = useMemo(() => {
    if (!contacts || !contactSearch.trim()) return [];
    const q = contactSearch.toLowerCase();
    return (contacts as any[])
      .filter((c: any) =>
        c.name.toLowerCase().includes(q) ||
        (c.businessName && c.businessName.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [contacts, contactSearch]);

  const calDays = useMemo(() => getMonthDays(calYear, calMonth), [calYear, calMonth]);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const locationDisplay = useMemo(() => {
    if (locationPreset === "hub" && selectedVenueId && venues) {
      const v = (venues as any[]).find((v: any) => v.id === selectedVenueId);
      return v ? `Hub — ${v.name}` : "Hub";
    }
    if (locationPreset === "hub") return "Hub — Reserve Tāmaki, 133a Line Road";
    if (locationPreset === "zoom") return "Zoom";
    if (locationPreset === "cafe") return customLocation || "Café";
    if (locationPreset === "their-office") return customLocation || "Their Office";
    if (customLocation) return customLocation;
    return "";
  }, [locationPreset, selectedVenueId, venues, customLocation]);

  async function handleQuickAdd() {
    if (!quickAddName.trim()) return;
    try {
      const result = await createContactMutation.mutateAsync({
        name: quickAddName.trim(),
        email: quickAddEmail.trim() || null,
        role: "external",
      });
      setSelectedContact(result);
      setShowQuickAdd(false);
      setQuickAddName("");
      setQuickAddEmail("");
      setContactSearch("");
    } catch {
      // toast handled by hook
    }
  }

  async function handleConfirm() {
    if (!selectedContact || !selectedDate || !selectedTime) return;

    const [year, month, day] = selectedDate.split("-").map(Number);
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const startTime = new Date(year, month - 1, day, hours, minutes);
    const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

    const typeName = selectedType?.name || "Meeting";
    const title = `${typeName} — ${selectedContact.name}`;

    try {
      await createMeetingMutation.mutateAsync({
        contactId: selectedContact.id,
        title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        type: selectedType?.category === "mentoring" ? "mentoring" : "catchup",
        duration,
        location: locationPreset === "hub" ? null : (locationDisplay || null),
        venueId: locationPreset === "hub" ? selectedVenueId : null,
        notes: notes || null,
        meetingTypeId: selectedType?.id || null,
        sendInvites: sendInvite,
        bookingSource: "internal",
      } as any);
      setStep("done");
    } catch {
      // toast handled by hook
    }
  }

  function resetForm() {
    setStep("who");
    setSelectedContact(null);
    setContactSearch("");
    setSelectedType(null);
    setNotes("");
    setSelectedDate("");
    setSelectedTime("10:00");
    setDuration(30);
    setLocationPreset("");
    setSelectedVenueId(null);
    setCustomLocation("");
    setSendInvite(true);
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {step !== "who" && step !== "done" && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => {
              if (step === "what") setStep("who");
              if (step === "where") setStep("what");
              if (step === "confirm") setStep("where");
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
        )}
        <div>
          <h1 className="text-xl font-bold">
            {step === "done" ? "Scheduled" : "Quick Meet"}
          </h1>
          {step !== "done" && (
            <p className="text-xs text-muted-foreground">
              {step === "who" && "Who are you meeting?"}
              {step === "what" && "What and when?"}
              {step === "where" && "Where?"}
              {step === "confirm" && "Confirm and send"}
            </p>
          )}
        </div>
      </div>

      {/* Step 1: Who */}
      {step === "who" && (
        <div className="space-y-4">
          {selectedContact ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedContact.name}</p>
                    {selectedContact.businessName && (
                      <p className="text-sm text-muted-foreground">{selectedContact.businessName}</p>
                    )}
                    {selectedContact.email && (
                      <p className="text-xs text-muted-foreground">{selectedContact.email}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedContact(null)}>
                    Change
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, business, or email..."
                  className="pl-9 h-11"
                  value={contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowQuickAdd(false);
                  }}
                  autoFocus
                />
              </div>

              {contactSearch.trim() && filteredContacts.length > 0 && (
                <div className="border rounded-lg divide-y">
                  {filteredContacts.map((c: any) => (
                    <button
                      key={c.id}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedContact(c);
                        setContactSearch("");
                      }}
                    >
                      <p className="text-sm font-medium">{c.name}</p>
                      {c.businessName && (
                        <p className="text-xs text-muted-foreground">{c.businessName}</p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {contactSearch.trim() && filteredContacts.length === 0 && !showQuickAdd && (
                <div className="text-center py-6 space-y-3">
                  <p className="text-sm text-muted-foreground">No contacts found</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      setShowQuickAdd(true);
                      setQuickAddName(contactSearch);
                    }}
                  >
                    <UserPlus className="w-4 h-4" />
                    Add new contact
                  </Button>
                </div>
              )}

              {showQuickAdd && (
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm font-medium">Quick add contact</p>
                    <div>
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={quickAddName}
                        onChange={(e) => setQuickAddName(e.target.value)}
                        placeholder="Full name"
                        className="h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Email</Label>
                      <Input
                        value={quickAddEmail}
                        onChange={(e) => setQuickAddEmail(e.target.value)}
                        placeholder="email@example.com"
                        type="email"
                        className="h-10"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={handleQuickAdd}
                        disabled={!quickAddName.trim() || createContactMutation.isPending}
                      >
                        {createContactMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-1" />
                        ) : (
                          <UserPlus className="w-4 h-4 mr-1" />
                        )}
                        Add
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowQuickAdd(false)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {selectedContact && (
            <Button className="w-full h-11" onClick={() => setStep("what")}>
              Next
            </Button>
          )}
        </div>
      )}

      {/* Step 2: What & When */}
      {step === "what" && (
        <div className="space-y-5">
          {/* Meeting Type */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {meetingTypes
                .filter((t: MeetingType) => t.isActive !== false)
                .map((t: any) => (
                  <button
                    key={t.id}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      selectedType?.id === t.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => {
                      setSelectedType(t);
                      setDuration(t.duration);
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: t.color || "#3b82f6" }}
                      />
                      <span className="text-sm font-medium">{t.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-4.5">{t.duration} min</span>
                  </button>
                ))}
            </div>
          </div>

          {/* Date */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Date</Label>
            <div className="border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                    else setCalMonth(calMonth - 1);
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium">
                  {new Date(calYear, calMonth).toLocaleDateString("en-NZ", { month: "long", year: "numeric" })}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                    else setCalMonth(calMonth + 1);
                  }}
                >
                  <ChevronLeft className="w-4 h-4 rotate-180" />
                </Button>
              </div>
              <div className="grid grid-cols-7 text-center text-[10px] text-muted-foreground mb-1">
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {calDays.map((cell, i) => {
                  const isPast = cell.date < todayStr;
                  const isSelected = cell.date === selectedDate;
                  const isToday = cell.date === todayStr;
                  return (
                    <button
                      key={i}
                      disabled={isPast || !cell.inMonth}
                      className={`h-9 rounded text-xs transition-colors ${
                        !cell.inMonth ? "text-muted-foreground/30" :
                        isPast ? "text-muted-foreground/40" :
                        isSelected ? "bg-primary text-primary-foreground font-medium" :
                        isToday ? "bg-muted font-medium" :
                        "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedDate(cell.date)}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Time & Duration */}
          {selectedDate && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Start time</Label>
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                >
                  {TIME_OPTIONS.map(t => (
                    <option key={t} value={t}>{formatTime(t)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Duration</Label>
                <select
                  className="w-full h-10 border rounded-md px-3 text-sm bg-background"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {[15, 30, 45, 60, 90].map(d => (
                    <option key={d} value={d}>{d} min</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes / agenda</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What's this meeting about?"
              rows={2}
              className="resize-none"
            />
          </div>

          <Button
            className="w-full h-11"
            disabled={!selectedType || !selectedDate || !selectedTime}
            onClick={() => setStep("where")}
          >
            Next
          </Button>
        </div>
      )}

      {/* Step 3: Where */}
      {step === "where" && (
        <div className="space-y-4">
          <Label className="text-sm font-medium block">Location</Label>

          <div className="grid grid-cols-2 gap-2">
            {LOCATION_PRESETS.map((loc) => {
              const Icon = loc.icon;
              const isSelected = locationPreset === loc.id;
              return (
                <button
                  key={loc.id}
                  className={`p-4 rounded-lg border text-center transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:bg-muted/50"
                  }`}
                  onClick={() => {
                    setLocationPreset(loc.id);
                    setSelectedVenueId(null);
                    if (loc.id !== "cafe" && loc.id !== "their-office") {
                      setCustomLocation("");
                    }
                  }}
                >
                  <Icon className="w-5 h-5 mx-auto mb-1.5" />
                  <span className="text-sm font-medium">{loc.label}</span>
                </button>
              );
            })}
          </div>

          {/* Hub venue picker */}
          {locationPreset === "hub" && venues && (venues as any[]).length > 0 && (
            <div>
              <Label className="text-xs mb-1 block">Which space?</Label>
              <div className="grid grid-cols-1 gap-1.5">
                {(venues as any[])
                  .filter((v: any) => v.active !== false)
                  .map((v: any) => (
                    <button
                      key={v.id}
                      className={`px-3 py-2 rounded-md border text-left text-sm transition-colors ${
                        selectedVenueId === v.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedVenueId(v.id)}
                    >
                      {v.name}
                      {v.spaceName && <span className="text-xs text-muted-foreground ml-1.5">({v.spaceName})</span>}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Custom location for café / their office */}
          {(locationPreset === "cafe" || locationPreset === "their-office") && (
            <div>
              <Label className="text-xs">
                {locationPreset === "cafe" ? "Which café?" : "Address or details"}
              </Label>
              <Input
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder={locationPreset === "cafe" ? "e.g. Mojo Glen Innes" : "e.g. Level 2, 123 Queen St"}
                className="h-10"
              />
            </div>
          )}

          {/* Or type something else */}
          {!locationPreset && (
            <div>
              <Label className="text-xs">Or type a location</Label>
              <Input
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="e.g. Google Meet, their office, park..."
                className="h-10"
              />
            </div>
          )}

          <Button
            className="w-full h-11"
            disabled={!locationPreset && !customLocation.trim()}
            onClick={() => setStep("confirm")}
          >
            Next
          </Button>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === "confirm" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarPlus className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium">{selectedType?.name || "Meeting"}</p>
                  <p className="text-sm text-muted-foreground">with {selectedContact?.name}</p>
                </div>
              </div>

              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>
                    {selectedDate && formatDateNice(selectedDate)}, {formatTime(selectedTime)} — {duration} min
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{locationDisplay}</span>
                </div>
                {notes && (
                  <p className="text-sm text-muted-foreground mt-1 pl-6">{notes}</p>
                )}
              </div>

              {selectedContact?.email && (
                <div className="border-t pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Send className="w-4 h-4 text-muted-foreground" />
                      <span>Send calendar invite to {selectedContact.email}</span>
                    </div>
                    <Switch checked={sendInvite} onCheckedChange={setSendInvite} />
                  </div>
                </div>
              )}

              {!selectedContact?.email && (
                <div className="border-t pt-3">
                  <p className="text-xs text-amber-600">
                    No email on file — calendar event will be created but no invite sent.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Button
            className="w-full h-11 gap-2"
            onClick={handleConfirm}
            disabled={createMeetingMutation.isPending}
          >
            {createMeetingMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Confirm & Schedule
          </Button>
        </div>
      )}

      {/* Done */}
      {step === "done" && (
        <div className="text-center py-12 space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
            <Check className="w-7 h-7 text-green-600" />
          </div>
          <div>
            <p className="font-medium text-lg">Meeting scheduled</p>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedType?.name} with {selectedContact?.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedDate && formatDateNice(selectedDate)}, {formatTime(selectedTime)}
            </p>
          </div>
          <div className="flex gap-2 justify-center pt-2">
            <Button variant="outline" onClick={resetForm}>
              Schedule another
            </Button>
            <Button variant="outline" asChild>
              <a href="/calendar">View calendar</a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
