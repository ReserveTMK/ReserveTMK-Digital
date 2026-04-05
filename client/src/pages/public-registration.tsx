import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useRoute } from "wouter";
import {
  Loader2,
  Calendar,
  Clock,
  MapPin,
  Users,
  Check,
  AlertCircle,
  UserPlus,
} from "lucide-react";

interface ProgrammeInfo {
  id: number;
  name: string;
  description: string | null;
  classification: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  capacity: number | null;
  registrationCount: number;
  spotsRemaining: number | null;
  isFull: boolean;
}

function formatDisplayDate(dateStr: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(timeStr: string | null) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m}${ampm}`;
}

export default function PublicRegistrationPage() {
  const [, params] = useRoute("/register/:slug");
  const slug = params?.slug || "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [dietaryRequirements, setDietaryRequirements] = useState("");
  const [accessibilityNeeds, setAccessibilityNeeds] = useState("");
  const [referralSource, setReferralSource] = useState("");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const {
    data: programme,
    isLoading,
    isError,
  } = useQuery<ProgrammeInfo>({
    queryKey: ["/api/public/programme", slug],
    queryFn: async () => {
      const res = await fetch(`/api/public/programme/${slug}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const registerMutation = useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      organization?: string;
      dietaryRequirements?: string;
      accessibilityNeeds?: string;
      referralSource?: string;
    }) => {
      const res = await fetch(`/api/public/programme/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw { message: err.message || "Registration failed", code: err.code };
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitError(null);
      setErrorCode(null);
    },
    onError: (err: any) => {
      setSubmitError(err.message || "Something went wrong");
      setErrorCode(err.code || null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setErrorCode(null);

    if (!firstName.trim() || !lastName.trim() || !email.trim()) return;

    registerMutation.mutate({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      organization: organization.trim() || undefined,
      dietaryRequirements: dietaryRequirements.trim() || undefined,
      accessibilityNeeds: accessibilityNeeds.trim() || undefined,
      referralSource: referralSource.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" data-testid="spinner-loading" />
      </div>
    );
  }

  if (isError || !programme) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full sm:max-w-lg p-8 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2" data-testid="heading-not-found">Programme not found</h2>
          <p className="text-sm text-muted-foreground" data-testid="text-not-found">
            This registration link may be incorrect or the programme is no longer accepting registrations.
          </p>
        </Card>
      </div>
    );
  }

  if (registerMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full sm:max-w-md p-8 text-center">
          <div className="flex justify-center mb-4">
            <div
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center"
              style={{ animation: "regCheckPop 0.5s ease-out" }}
              data-testid="icon-confirmed-check"
            >
              <Check className="w-8 h-8 text-white" style={{ animation: "regCheckDraw 0.4s ease-out 0.2s both" }} />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1" data-testid="heading-confirmed">You're registered!</h2>
          <p className="text-muted-foreground mb-6" data-testid="text-confirmed-subtitle">
            Your registration for <span className="font-medium text-foreground">{programme.name}</span> has been confirmed.
          </p>
          <div className="bg-muted/50 rounded-md p-4 space-y-2 text-sm text-left">
            {programme.startDate && (
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium" data-testid="text-confirmed-date">{formatDisplayDate(programme.startDate)}</span>
              </div>
            )}
            {programme.startTime && (
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium" data-testid="text-confirmed-time">
                  {formatTime(programme.startTime)}
                  {programme.endTime ? ` – ${formatTime(programme.endTime)}` : ""}
                </span>
              </div>
            )}
            {programme.location && (
              <div className="flex justify-between gap-2 flex-wrap">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium" data-testid="text-confirmed-location">{programme.location}</span>
              </div>
            )}
          </div>
          <div className="mt-5 p-3 bg-muted/30 rounded-md text-left">
            <p className="text-xs font-semibold text-muted-foreground mb-1">What happens next</p>
            <p className="text-xs text-muted-foreground">
              You'll receive updates about the programme closer to the date. If you need to cancel, please contact the organiser.
            </p>
          </div>
        </Card>
        <style>{`
          @keyframes regCheckPop {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.15); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes regCheckDraw {
            0% { opacity: 0; transform: scale(0.5); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  if (programme.isFull) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full sm:max-w-lg p-8 text-center">
          <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2" data-testid="heading-full">Registrations closed</h2>
          <p className="text-sm text-muted-foreground mb-4" data-testid="text-full">
            <span className="font-medium text-foreground">{programme.name}</span> has reached full capacity.
          </p>
          <p className="text-xs text-muted-foreground">
            Please contact the organiser if you'd like to be added to a waitlist.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col items-center justify-start sm:justify-center p-0 sm:p-4">
      <Card className="w-full sm:max-w-lg sm:rounded-md rounded-none border-0 sm:border min-h-screen sm:min-h-0 flex flex-col">
        <div className="p-5 sm:p-6 border-b">
          <div className="flex items-center gap-1 mb-3">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase" data-testid="text-classification">
              {programme.classification}
            </span>
          </div>
          <h1 className="text-lg font-bold" data-testid="heading-programme-name">{programme.name}</h1>
          {programme.description && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-description">
              {programme.description}
            </p>
          )}

          <div className="flex flex-col gap-1.5 mt-4">
            {programme.startDate && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span data-testid="text-date">
                  {formatDisplayDate(programme.startDate)}
                  {programme.endDate && programme.endDate !== programme.startDate
                    ? ` – ${formatDisplayDate(programme.endDate)}`
                    : ""}
                </span>
              </div>
            )}
            {programme.startTime && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span data-testid="text-time">
                  {formatTime(programme.startTime)}
                  {programme.endTime ? ` – ${formatTime(programme.endTime)}` : ""}
                </span>
              </div>
            )}
            {programme.location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span data-testid="text-location">{programme.location}</span>
              </div>
            )}
            {programme.spotsRemaining !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-3.5 h-3.5 shrink-0" />
                <span data-testid="text-spots">
                  {programme.spotsRemaining} spot{programme.spotsRemaining !== 1 ? "s" : ""} remaining
                </span>
              </div>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="p-5 sm:p-6 space-y-4 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold" data-testid="heading-register">Register</h2>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs">First name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  data-testid="input-first-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-xs">Last name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  data-testid="input-last-name"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="input-email"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                data-testid="input-phone"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="organization" className="text-xs">Organisation</Label>
              <Input
                id="organization"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                data-testid="input-organization"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dietary" className="text-xs">Dietary requirements</Label>
              <Input
                id="dietary"
                value={dietaryRequirements}
                onChange={(e) => setDietaryRequirements(e.target.value)}
                data-testid="input-dietary"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="accessibility" className="text-xs">Accessibility needs</Label>
              <Input
                id="accessibility"
                value={accessibilityNeeds}
                onChange={(e) => setAccessibilityNeeds(e.target.value)}
                data-testid="input-accessibility"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="referral" className="text-xs">How did you hear about us?</Label>
              <Select value={referralSource} onValueChange={setReferralSource}>
                <SelectTrigger className="text-sm" data-testid="input-referral">
                  <SelectValue placeholder="Select one..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Social media">Social media</SelectItem>
                  <SelectItem value="Friend / whānau">Friend / whānau</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Wix website">Wix website</SelectItem>
                  <SelectItem value="Community board">Community board</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {submitError && (
              <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-md" data-testid="alert-error">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">
                  {errorCode === "DUPLICATE"
                    ? "You're already registered for this programme. No need to register again!"
                    : errorCode === "FULL"
                    ? "Sorry, this programme has just reached full capacity."
                    : submitError}
                </p>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 border-t space-y-2">
            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending || !firstName.trim() || !lastName.trim() || !email.trim()}
              data-testid="button-submit-registration"
            >
              {registerMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {registerMutation.isPending ? "Registering..." : "Register"}
            </Button>
            <p className="text-[10px] text-muted-foreground text-center">
              By registering you agree to our <a href="/privacy" target="_blank" className="underline">privacy policy</a>
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}
