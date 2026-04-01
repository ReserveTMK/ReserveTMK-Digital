import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format, isPast, formatDistanceToNow } from "date-fns";
import { useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  Mail,
  Phone,
  User,
  Handshake,
  Target,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Radar,
} from "lucide-react";
import type { Funder } from "@shared/schema";
import { FunderDeliverablesSection, FunderTaxonomySection, FunderClassificationsSection } from "@/pages/funders";
import { Users, MapPin, TrendingUp as Growth } from "lucide-react";

// Static census context by community lens (from reference_geographic_lenses.md)
const COMMUNITY_CONTEXT: Record<string, { title: string; stats: Array<{ label: string; value: string; highlight?: boolean }> }> = {
  maori: {
    title: "Māori in Tāmaki",
    stats: [
      { label: "Māori in core area", value: "22%", highlight: true },
      { label: "Auckland average", value: "12%" },
      { label: "Māori population (hub proximity)", value: "~4,300" },
      { label: "Deprivation", value: "All decile 10" },
      { label: "Te reo speakers", value: "5% (2× Auckland rate)" },
    ],
  },
  pasifika: {
    title: "Pasifika in Tāmaki",
    stats: [
      { label: "Pasifika in core area", value: "46%", highlight: true },
      { label: "Auckland average", value: "17%" },
      { label: "Pasifika population (hub proximity)", value: "~4,800" },
      { label: "Deprivation", value: "All decile 10" },
      { label: "Under 30", value: "~47% of core community" },
    ],
  },
  all: {
    title: "Tāmaki Community",
    stats: [
      { label: "Hub reach population", value: "20,630", highlight: true },
      { label: "Māori & Pasifika (core)", value: "68%" },
      { label: "Businesses in area", value: "846" },
      { label: "Firms per 1,000 (most deprived SA2)", value: "25" },
      { label: "Deprivation", value: "Decile 9-10" },
      { label: "Median personal income (core)", value: "$34,000 (vs $44,700 Auckland)" },
    ],
  },
};

function formatCurrency(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}k`;
  return `$${amount}`;
}

const CADENCE_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
  adhoc: "Ad Hoc",
  on_completion: "On Completion",
};

const STYLE_LABELS: Record<string, string> = {
  compliance: "Compliance (stats-first)",
  story: "Story (narrative-first)",
  partnership: "Partnership (relationship-first)",
};

const STATUS_LABELS: Record<string, string> = {
  active_funder: "Active",
  in_conversation: "In Conversation",
  pending_eoi: "Pending EOI",
  applied: "Applied",
  radar: "Radar",
  completed: "Completed",
};

const STATUS_COLORS: Record<string, string> = {
  active_funder: "bg-green-100 text-green-800",
  in_conversation: "bg-blue-100 text-blue-800",
  pending_eoi: "bg-yellow-100 text-yellow-800",
  applied: "bg-purple-100 text-purple-800",
  radar: "bg-gray-100 text-gray-600",
  completed: "bg-gray-100 text-gray-600",
};

const FIT_TAG_COLORS: Record<string, string> = {
  maori: "bg-orange-100 text-orange-700",
  youth: "bg-pink-100 text-pink-700",
  enterprise: "bg-blue-100 text-blue-700",
  arts: "bg-purple-100 text-purple-700",
  placemaking: "bg-teal-100 text-teal-700",
  community: "bg-green-100 text-green-700",
  pasifika: "bg-cyan-100 text-cyan-700",
  innovation: "bg-indigo-100 text-indigo-700",
};

const APPLICATION_STEPS = [
  { status: "radar", label: "Research" },
  { status: "in_conversation", label: "In Conversation" },
  { status: "pending_eoi", label: "EOI" },
  { status: "applied", label: "Applied" },
  { status: "active_funder", label: "Funded" },
];

const ACTIVE_STATUSES = ["active_funder"];
const PIPELINE_STATUSES = ["in_conversation", "pending_eoi", "applied", "radar"];

export default function FunderDetailPage() {
  const [, params] = useRoute("/funders/:id");
  const [, setLocation] = useLocation();
  const funderId = parseInt(params?.id || "0");

  const { data: funder, isLoading } = useQuery<Funder>({
    queryKey: ["/api/funders", funderId],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: funderId > 0,
  });

  const contractProgress = useMemo(() => {
    if (!funder?.contractStart || !funder?.contractEnd) return null;
    const start = new Date(funder.contractStart).getTime();
    const end = new Date(funder.contractEnd).getTime();
    const now = Date.now();
    return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
  }, [funder]);

  const contractPeriod = useMemo(() => {
    if (!funder?.contractStart || !funder?.contractEnd) return null;
    return `${format(new Date(funder.contractStart), "MMM yyyy")} — ${format(new Date(funder.contractEnd), "MMM yyyy")}`;
  }, [funder]);

  const isActive = funder ? ACTIVE_STATUSES.includes(funder.status) : false;
  const isPursuing = funder ? PIPELINE_STATUSES.includes(funder.status) : false;

  const { data: innovatorStats } = useQuery<any>({
    queryKey: ["/api/funders", funderId, "innovator-stats"],
    queryFn: async () => {
      const res = await fetch(`/api/funders/${funderId}/innovator-stats`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: funderId > 0 && !!funder,
  });

  const communityContext = funder ? COMMUNITY_CONTEXT[(funder as any).communityLens || "all"] || COMMUNITY_CONTEXT.all : null;

  const currentStepIndex = funder ? APPLICATION_STEPS.findIndex(s => s.status === funder.status) : -1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!funder) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <p className="text-muted-foreground">Funder not found</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/funders")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Funding
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setLocation("/funders")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{funder.name}</h1>
            {funder.estimatedValue && (
              <span className="text-lg font-medium text-green-700 dark:text-green-400">
                {formatCurrency(funder.estimatedValue)}{isActive ? "/yr" : ""}
              </span>
            )}
            <Badge className={STATUS_COLORS[funder.status]}>
              {STATUS_LABELS[funder.status]}
            </Badge>
          </div>
          {funder.organisation && funder.organisation.toLowerCase() !== funder.name.toLowerCase() && (
            <p className="text-sm text-muted-foreground">{funder.organisation}</p>
          )}
        </div>
        {isActive && (
          <Button variant="outline" size="sm" onClick={() => setLocation(`/reports?funder=${funder.id}`)}>
            <FileText className="w-4 h-4 mr-2" /> Generate Report
          </Button>
        )}
      </div>

      {/* Key Info Strip */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {isActive && funder.reportingCadence && (
          <Badge variant="outline">{CADENCE_LABELS[funder.reportingCadence]}</Badge>
        )}
        {isActive && funder.narrativeStyle && (
          <Badge variant="outline">{STYLE_LABELS[funder.narrativeStyle]}</Badge>
        )}
        {contractPeriod && (
          <span className="text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {contractPeriod}
          </span>
        )}
        {contractProgress !== null && (
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: `${contractProgress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{contractProgress}%</span>
          </div>
        )}
        {funder.fitTags && funder.fitTags.length > 0 && funder.fitTags.map(tag => (
          <Badge key={tag} className={`text-xs ${FIT_TAG_COLORS[tag] || "bg-gray-100 text-gray-600"}`}>{tag}</Badge>
        ))}
      </div>

      {/* ═══════════ PURSUING / APPLYING VIEW ═══════════ */}
      {isPursuing && (
        <>
          {/* Application Progress Tracker */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Application Progress
            </h3>
            <div className="flex items-center gap-1">
              {APPLICATION_STEPS.map((step, i) => {
                const isCompleted = i < currentStepIndex;
                const isCurrent = i === currentStepIndex;
                return (
                  <div key={step.status} className="flex items-center gap-1 flex-1">
                    <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium shrink-0 ${
                      isCompleted ? "bg-green-500 text-white" :
                      isCurrent ? "bg-primary text-white" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className={`text-xs truncate ${isCurrent ? "font-semibold" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                    {i < APPLICATION_STEPS.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 rounded ${isCompleted ? "bg-green-500" : "bg-muted"}`} />
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Fund Profile — what they care about */}
              {(funder.outcomesFramework || funder.outcomeFocus) && (
                <Card className="p-5">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    What They Fund
                  </h3>
                  {funder.outcomesFramework && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.outcomesFramework}</p>
                  )}
                  {funder.outcomeFocus && (
                    <p className="text-sm text-muted-foreground mt-2">
                      <span className="font-medium">Focus areas:</span> {funder.outcomeFocus}
                    </p>
                  )}
                </Card>
              )}

              {/* How to write to them */}
              {(funder.reportingGuidance || funder.narrativeStyle) && (
                <Card className="p-5">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    How to Write to Them
                  </h3>
                  {funder.narrativeStyle && (
                    <p className="text-sm text-muted-foreground mb-2">
                      <span className="font-medium">Style:</span> {STYLE_LABELS[funder.narrativeStyle]}
                    </p>
                  )}
                  {funder.reportingGuidance && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.reportingGuidance}</p>
                  )}
                </Card>
              )}

              {/* Partnership Strategy / Approach */}
              {funder.partnershipStrategy && (
                <Card className="p-5">
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Handshake className="w-4 h-4 text-primary" />
                    Our Approach
                  </h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.partnershipStrategy}</p>
                </Card>
              )}

              {/* Notes */}
              {funder.notes && (
                <Card className="p-5">
                  <h3 className="text-sm font-semibold mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.notes}</p>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Next Action */}
              {funder.nextAction && (
                <Card className="p-4 border-primary/30 bg-primary/5">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Next Action</h3>
                  <p className="text-sm font-medium">{funder.nextAction}</p>
                </Card>
              )}

              {/* Deadline */}
              {funder.applicationDeadline && (
                <Card className={`p-4 ${isPast(new Date(funder.applicationDeadline)) ? "border-red-300 bg-red-50/50 dark:bg-red-900/10" : "border-amber-300 bg-amber-50/50 dark:bg-amber-900/10"}`}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Application Deadline</h3>
                  <p className="text-sm font-medium">{format(new Date(funder.applicationDeadline), "d MMM yyyy")}</p>
                  <p className={`text-xs mt-1 ${isPast(new Date(funder.applicationDeadline)) ? "text-red-600" : "text-amber-600"}`}>
                    {isPast(new Date(funder.applicationDeadline))
                      ? "Deadline passed"
                      : formatDistanceToNow(new Date(funder.applicationDeadline), { addSuffix: true })}
                  </p>
                </Card>
              )}

              {/* Contact */}
              {(funder.contactPerson || funder.contactEmail || funder.contactPhone) && (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact</h3>
                  <div className="space-y-2 text-sm">
                    {funder.contactPerson && (
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{funder.contactPerson}</span>
                      </div>
                    )}
                    {funder.contactEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                        <a href={`mailto:${funder.contactEmail}`} className="text-primary hover:underline truncate">{funder.contactEmail}</a>
                      </div>
                    )}
                    {funder.contactPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{funder.contactPhone}</span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Value */}
              {funder.estimatedValue && (
                <Card className="p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Estimated Value</h3>
                  <p className="text-lg font-bold text-green-700 dark:text-green-400">{formatCurrency(funder.estimatedValue)}</p>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════ CONTEXT + STATS (active + pursuing) ═══════════ */}
      {(isActive || isPursuing) && communityContext && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Community Context — static census data */}
          <Card className="p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5" />
              {communityContext.title}
            </h3>
            <div className="space-y-2">
              {communityContext.stats.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{s.label}</span>
                  <span className={s.highlight ? "font-bold text-foreground" : "font-medium"}>{s.value}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">Source: Stats NZ 2023 Census, SA2 data</p>
          </Card>

          {/* Live Innovator Stats */}
          {innovatorStats && (
            <Card className="p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <Users className="w-3.5 h-3.5" />
                {innovatorStats.lens === "all" ? "All Innovators" : innovatorStats.lens === "maori" ? "Māori Innovators" : "Pasifika Innovators"}
              </h3>
              <div className="space-y-3">
                <div className="text-3xl font-bold">{innovatorStats.total}</div>
                {innovatorStats.lens === "all" && innovatorStats.ethnicityBreakdown && (
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>{innovatorStats.ethnicityBreakdown.maori} Māori</span>
                    <span>{innovatorStats.ethnicityBreakdown.pasifika} Pasifika</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">Kākano {innovatorStats.stages?.kakano || 0}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="text-xs">Tipu {innovatorStats.stages?.tipu || 0}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="text-xs">Ora {innovatorStats.stages?.ora || 0}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3 pt-2 border-t text-center">
                  <div>
                    <p className="text-lg font-bold">{innovatorStats.progressionsThisQuarter}</p>
                    <p className="text-[10px] text-muted-foreground">Progressed</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{innovatorStats.mentoringSessionsThisQuarter}</p>
                    <p className="text-[10px] text-muted-foreground">1:1 Sessions</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{innovatorStats.programmeCompletionsThisQuarter}</p>
                    <p className="text-[10px] text-muted-foreground">1:Few Completions</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">This quarter · Live from platform</p>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════ ACTIVE FUNDER VIEW ═══════════ */}
      {isActive && (
        <>
        {/* Deliverables, Taxonomy, Classifications — full width */}
        <FunderDeliverablesSection funderId={funder.id} />
        <FunderTaxonomySection funderId={funder.id} />
        <FunderClassificationsSection funderId={funder.id} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {funder.outcomesFramework && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Outcomes Framework
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.outcomesFramework}</p>
                {funder.outcomeFocus && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <span className="font-medium">Focus:</span> {funder.outcomeFocus}
                  </p>
                )}
              </Card>
            )}

            {funder.reportingGuidance && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Reporting Guidance
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.reportingGuidance}</p>
              </Card>
            )}

            {funder.partnershipStrategy && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-primary" />
                  Partnership Strategy
                </h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.partnershipStrategy}</p>
              </Card>
            )}

            {funder.notes && (
              <Card className="p-5">
                <h3 className="text-sm font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.notes}</p>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            {(funder.contactPerson || funder.contactEmail || funder.contactPhone) && (
              <Card className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact</h3>
                <div className="space-y-2 text-sm">
                  {funder.contactPerson && (
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{funder.contactPerson}</span>
                    </div>
                  )}
                  {funder.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <a href={`mailto:${funder.contactEmail}`} className="text-primary hover:underline">{funder.contactEmail}</a>
                    </div>
                  )}
                  {funder.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{funder.contactPhone}</span>
                    </div>
                  )}
                </div>
              </Card>
            )}

            <Card className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Key Dates</h3>
              <div className="space-y-2 text-sm">
                {funder.contractStart && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start</span>
                    <span>{format(new Date(funder.contractStart), "d MMM yyyy")}</span>
                  </div>
                )}
                {funder.contractEnd && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">End</span>
                    <span>{format(new Date(funder.contractEnd), "d MMM yyyy")}</span>
                  </div>
                )}
                {funder.reviewDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Review</span>
                    <span>{format(new Date(funder.reviewDate), "d MMM yyyy")}</span>
                  </div>
                )}
              </div>
            </Card>

            {funder.funderTag && (
              <Card className="p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Funder Tag</h3>
                <Badge variant="outline">{funder.funderTag}</Badge>
              </Card>
            )}
          </div>
        </div>
        </>
      )}

      {/* ═══════════ COMPLETED VIEW ═══════════ */}
      {funder.status === "completed" && (
        <div className="space-y-6">
          {funder.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-2">Notes</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.notes}</p>
            </Card>
          )}
          {(funder.contactPerson || funder.contactEmail) && (
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Contact</h3>
              <div className="space-y-2 text-sm">
                {funder.contactPerson && <p>{funder.contactPerson}</p>}
                {funder.contactEmail && <p className="text-muted-foreground">{funder.contactEmail}</p>}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
