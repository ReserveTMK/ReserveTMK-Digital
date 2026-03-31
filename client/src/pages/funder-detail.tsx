import { Button } from "@/components/ui/beautiful-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { format } from "date-fns";
import { useMemo } from "react";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  Mail,
  Phone,
  User,
  Handshake,
  Target,
} from "lucide-react";
import type { Funder } from "@shared/schema";

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
};

const STYLE_LABELS: Record<string, string> = {
  compliance: "Compliance (stats-first)",
  story: "Story (narrative-first)",
  partnership: "Partnership (relationship-first)",
};

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
                {formatCurrency(funder.estimatedValue)}/yr
              </span>
            )}
          </div>
          {funder.organisation && (
            <p className="text-sm text-muted-foreground">{funder.organisation}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setLocation(`/reports?funder=${funder.id}`)}>
            <FileText className="w-4 h-4 mr-2" /> Generate Report
          </Button>
        </div>
      </div>

      {/* Key Info Strip */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {funder.reportingCadence && (
          <Badge variant="outline">{CADENCE_LABELS[funder.reportingCadence]}</Badge>
        )}
        {funder.narrativeStyle && (
          <Badge variant="outline">{STYLE_LABELS[funder.narrativeStyle]}</Badge>
        )}
        {(funder as any).fundType === "project" && (
          <Badge variant="outline">Project Fund</Badge>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="md:col-span-2 space-y-6">
          {/* Outcomes Framework */}
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

          {/* Reporting Guidance */}
          {funder.reportingGuidance && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Reporting Guidance
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{funder.reportingGuidance}</p>
            </Card>
          )}

          {/* Partnership Strategy */}
          {funder.partnershipStrategy && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Handshake className="w-4 h-4 text-primary" />
                Partnership Strategy
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

          {/* Key Dates */}
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

          {/* Funder Tag */}
          {funder.funderTag && (
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Funder Tag</h3>
              <Badge variant="outline">{funder.funderTag}</Badge>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
