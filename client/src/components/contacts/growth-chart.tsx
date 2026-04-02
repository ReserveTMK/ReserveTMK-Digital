import { Badge } from "@/components/ui/badge";
import { TrendingUp, History, Rocket } from "lucide-react";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

export interface GrowthChartProps {
  snapshotChartData: Array<{
    date: string;
    timestamp: number;
    source: string;
    mindset?: number;
    skill?: number;
    confidence?: number;
    bizConfidence?: number;
    systems?: number;
    funding?: number;
    network?: number;
    community?: number;
  }>;
  chartData: Array<{
    date: string;
    mindset: number;
    skill: number;
    confidence: number;
    bizConfidence: number;
    systems: number;
    funding: number;
    network: number;
  }>;
  metricSnapshotsData?: Array<{ id: number; contactId: number; metrics: any; source: string; createdAt: string }>;
  contactJourney?: {
    debriefCount: number;
    milestones: Array<{ text: string; date: string; debriefTitle: string }>;
    quotes: Array<{ text: string; debriefTitle: string }>;
    sentimentArc: Array<{ date: string; sentiment: string; title: string }>;
  };
}

export function GrowthChart({ snapshotChartData, chartData, metricSnapshotsData, contactJourney }: GrowthChartProps) {
  return (
    <>
      <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Growth Trajectory
        </h3>
        <div className="h-[300px] w-full">
          {(snapshotChartData.length > 1 ? snapshotChartData : chartData).length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshotChartData.length > 1 ? snapshotChartData : chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={[0, 10]} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend />
                <Line type="monotone" dataKey="mindset" stroke="hsl(var(--brand-coral))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} connectNulls />
                <Line type="monotone" dataKey="skill" stroke="hsl(var(--brand-green))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} connectNulls />
                <Line type="monotone" dataKey="confidence" stroke="hsl(var(--brand-pink))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} connectNulls />
                <Line type="monotone" dataKey="bizConfidence" name="Biz Confidence" stroke="hsl(var(--brand-blue))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} connectNulls />
                <Line type="monotone" dataKey="systems" name="Systems" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} connectNulls />
                <Line type="monotone" dataKey="funding" name="Funding" stroke="hsl(var(--brand-dark-green))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} connectNulls />
                <Line type="monotone" dataKey="network" name="Network" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} connectNulls />
                {snapshotChartData.length > 1 && (
                  <Line type="monotone" dataKey="community" name="Community" stroke="hsl(var(--brand-pink))" strokeWidth={2} dot={{r: 3, strokeWidth: 2}} activeDot={{r: 5}} connectNulls strokeDasharray="5 5" />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <p>No enough data to show trends.</p>
              <p className="text-sm">Log some interactions to see progress.</p>
            </div>
          )}
        </div>
      </div>

      {metricSnapshotsData && metricSnapshotsData.length > 0 && (
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm" data-testid="growth-score-timeline">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-primary" />
            Growth Score Timeline
          </h3>
          <div className="space-y-3">
            {[...metricSnapshotsData]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map((snap, idx) => {
                const m = snap.metrics || {};
                const metricEntries = Object.entries(m).filter(([_, v]) => v != null && (v as number) > 0);
                const sourceLabels: Record<string, string> = { manual: "Manual Update", survey: "Growth Survey", debrief: "AI Debrief", current: "Current" };
                return (
                  <div key={snap.id} className="flex gap-4 items-start" data-testid={`snapshot-entry-${snap.id}`}>
                    <div className="flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${idx === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      {idx < metricSnapshotsData.length - 1 && <div className="w-0.5 h-full bg-border min-h-[40px]" />}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{format(new Date(snap.createdAt), 'MMM d, yyyy')}</span>
                        <Badge variant="outline" className="text-xs">{sourceLabels[snap.source] || snap.source}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {metricEntries.map(([key, val]) => {
                          const labels: Record<string, string> = {
                            mindset: "Mindset", skill: "Skill", confidence: "Confidence",
                            bizConfidence: "Biz Confidence", systemsInPlace: "Systems",
                            fundingReadiness: "Funding", networkStrength: "Network",
                            communityImpact: "Community", digitalPresence: "Digital",
                          };
                          return (
                            <span key={key} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground">
                              {labels[key] || key}: <strong>{String(val)}</strong>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Journey Summary from debriefs */}
      {contactJourney && contactJourney.milestones.length > 0 && (
        <div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-primary" />
            Journey ({contactJourney.debriefCount} debriefs)
          </h3>
          <div className="space-y-3">
            {contactJourney.milestones.map((m, idx) => (
              <div key={idx} className="flex gap-3 items-start">
                <div className="flex flex-col items-center">
                  <div className={`w-2.5 h-2.5 rounded-full ${idx === 0 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                  {idx < contactJourney.milestones.length - 1 && <div className="w-0.5 flex-1 bg-border min-h-[24px]" />}
                </div>
                <div className="flex-1 pb-2">
                  <p className="text-sm">{m.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.date} · {m.debriefTitle}</p>
                </div>
              </div>
            ))}
          </div>
          {contactJourney.quotes.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2">
              {contactJourney.quotes.slice(0, 3).map((q, idx) => (
                <div key={idx} className="text-xs italic text-muted-foreground bg-muted/30 rounded-md p-2">
                  "{q.text.length > 200 ? q.text.slice(0, 200) + "..." : q.text}"
                  <span className="block text-[10px] mt-1 not-italic">{q.debriefTitle}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
